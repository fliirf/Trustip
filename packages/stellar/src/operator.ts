import {
  Keypair,
  StrKey,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import {
  getOperatorSecretKey,
  isMainnetOperatorAllowed,
} from "@trustip/config";
import { networkName } from "./network.js";

// ---------------------------------------------------------------------------
// SERVER-ONLY admin/operator signer for escrow `create_order` (and future admin
// actions). The concrete env-keypair implementation must never run in a client
// bundle: it is constructed lazily from a non-NEXT_PUBLIC secret (see
// @trustip/config#getOperatorSecretKey) and is only reachable through the
// server-side payment gateway. The interface is intentionally minimal so a
// future KMS / multisig / remote-admin signer can replace the env keypair
// without touching callers. Secret material is never logged or returned.
// ---------------------------------------------------------------------------

export type OperatorSignerErrorCode =
  "AdminSignerMissing" | "AdminSignerNotAllowedOnMainnet";

/** Fail-closed error thrown while resolving the operator signer. Carries a code
 * the payment layer maps 1:1 to a typed PaymentError. Never includes secrets. */
export class OperatorSignerError extends Error {
  readonly code: OperatorSignerErrorCode;
  constructor(code: OperatorSignerErrorCode, message: string) {
    super(message);
    this.name = "OperatorSignerError";
    this.code = code;
  }
}

export interface OperatorSigner {
  /** The operator/admin public key (G...). Must equal the contract's admin. */
  readonly publicKey: string;
  /** Sign a built transaction's XDR for `networkPassphrase`; returns signed XDR.
   * Async-friendly so a remote signer (KMS) can implement the same shape. */
  signXdr(unsignedXdr: string, networkPassphrase: string): Promise<string>;
}

/** Inputs to the pure signer policy — separated from env for testability. */
export interface OperatorSignerPolicy {
  /** Raw secret seed (S...), or undefined when unconfigured. */
  secretKey: string | undefined;
  isMainnet: boolean;
  /** Explicit opt-in required to use the env-key signer on mainnet. */
  allowMainnet: boolean;
}

class EnvKeypairOperatorSigner implements OperatorSigner {
  private readonly keypair: Keypair;
  constructor(keypair: Keypair) {
    this.keypair = keypair;
  }
  get publicKey(): string {
    return this.keypair.publicKey();
  }
  async signXdr(
    unsignedXdr: string,
    networkPassphrase: string,
  ): Promise<string> {
    const tx = TransactionBuilder.fromXDR(unsignedXdr, networkPassphrase);
    if (!(tx instanceof Transaction)) {
      throw new Error(
        "operator can only sign plain (non-fee-bump) transactions",
      );
    }
    tx.sign(this.keypair);
    return tx.toXDR();
  }
}

/**
 * Pure, fail-closed operator-signer factory. Refuses mainnet unless explicitly
 * allowed, then requires a valid secret seed. Validates the seed WITHOUT ever
 * putting its value in an error message.
 */
export function buildOperatorSigner(
  policy: OperatorSignerPolicy,
): OperatorSigner {
  // Mainnet guard first: on mainnet the env-key signer is refused outright
  // (regardless of whether a secret is present) unless deliberately enabled.
  if (policy.isMainnet && !policy.allowMainnet) {
    throw new OperatorSignerError(
      "AdminSignerNotAllowedOnMainnet",
      "env-secret operator signing is disabled on mainnet; enable an approved signer strategy explicitly",
    );
  }
  const secret = policy.secretKey;
  if (!secret) {
    throw new OperatorSignerError(
      "AdminSignerMissing",
      "operator/admin signer secret is not configured",
    );
  }
  if (!StrKey.isValidEd25519SecretSeed(secret)) {
    // Do NOT include the secret value in the message.
    throw new OperatorSignerError(
      "AdminSignerMissing",
      "operator/admin signer secret is not a valid Stellar secret seed",
    );
  }
  return new EnvKeypairOperatorSigner(Keypair.fromSecret(secret));
}

/**
 * Resolve the operator signer from server-only env for the active network.
 * SERVER-ONLY — call sites (the escrow gateway) are reached only through the
 * server payment path. Fails closed when unset / not permitted.
 */
export function createEnvOperatorSigner(): OperatorSigner {
  return buildOperatorSigner({
    secretKey: getOperatorSecretKey(),
    isMainnet: networkName() === "mainnet",
    allowMainnet: isMainnetOperatorAllowed(),
  });
}
