import {
  Account,
  BASE_FEE,
  Keypair,
  Memo,
  Operation,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

/**
 * Wallet-ownership challenge transaction (SEP-10's core mechanism, scoped to
 * Trustip seller onboarding). The server builds an UNSIGNED transaction that is
 * safe for a wallet to sign but impossible to submit meaningfully:
 *
 *  - the transaction SOURCE is a freshly generated random account whose secret
 *    is discarded immediately — the account does not exist on any network and
 *    its (required) envelope signature can never be produced;
 *  - the single operation is a `manageData` write carrying a server-issued
 *    nonce, with the WALLET as the operation source, so a correct wallet adds
 *    its signature over the transaction hash;
 *  - the network passphrase is part of the signed hash, binding the signature
 *    to one network.
 *
 * Verification checks the exact structure and that one of the envelope
 * signatures verifies against the claimed wallet public key. Nonce issuance /
 * expiry / user binding live server-side (HMAC token) — this module is pure
 * Stellar crypto and holds no secrets.
 */

/** manageData entry name — domain separation at the transaction level. */
export const WALLET_CHALLENGE_DATA_NAME = "trustip:wallet-verify";

const WALLET_CHALLENGE_MEMO = "TRUSTIP WALLET VERIFY";
/** Challenge transactions expire quickly; signing is an interactive step. */
const WALLET_CHALLENGE_TIMEOUT_SECONDS = 300;

export interface WalletChallengeTxParams {
  /** The wallet public key whose ownership is being proven. */
  walletPublicKey: string;
  networkPassphrase: string;
  /** Server-issued nonce (HMAC-bound elsewhere). Must fit manageData (≤64B). */
  nonce: string;
}

/** Build the unsigned challenge XDR. Never touches the network. */
export function buildWalletChallengeTx(
  params: WalletChallengeTxParams,
): string {
  if (params.nonce.length === 0 || params.nonce.length > 64) {
    throw new Error("challenge nonce must be 1–64 bytes");
  }
  // Random, discarded source: the envelope can never be validly submitted.
  const throwawaySource = new Account(Keypair.random().publicKey(), "0");
  const tx = new TransactionBuilder(throwawaySource, {
    fee: BASE_FEE,
    networkPassphrase: params.networkPassphrase,
  })
    .addOperation(
      Operation.manageData({
        name: WALLET_CHALLENGE_DATA_NAME,
        value: params.nonce,
        source: params.walletPublicKey,
      }),
    )
    .addMemo(Memo.text(WALLET_CHALLENGE_MEMO))
    .setTimeout(WALLET_CHALLENGE_TIMEOUT_SECONDS)
    .build();
  return tx.toXDR();
}

export interface WalletChallengeVerifyParams {
  signedXdr: string;
  walletPublicKey: string;
  networkPassphrase: string;
  nonce: string;
}

/**
 * Verify a signed challenge: exact structure (single manageData op with the
 * expected name/nonce, wallet as op source) AND a valid wallet signature over
 * the transaction hash. Returns false for anything unexpected — never throws.
 */
export function verifyWalletChallengeTx(
  params: WalletChallengeVerifyParams,
): boolean {
  let tx: Transaction;
  try {
    const parsed = TransactionBuilder.fromXDR(
      params.signedXdr,
      params.networkPassphrase,
    );
    if (!(parsed instanceof Transaction)) return false;
    tx = parsed;
  } catch {
    return false;
  }

  if (tx.operations.length !== 1) return false;
  const op = tx.operations[0]!;
  if (op.type !== "manageData") return false;
  if (op.name !== WALLET_CHALLENGE_DATA_NAME) return false;
  if (op.source !== params.walletPublicKey) return false;
  const value = op.value;
  if (!value || value.toString("utf8") !== params.nonce) return false;

  // The wallet must have signed the transaction hash (network-bound).
  let keypair: Keypair;
  try {
    keypair = Keypair.fromPublicKey(params.walletPublicKey);
  } catch {
    return false;
  }
  const hash = tx.hash();
  const expectedHint = keypair.signatureHint();
  return tx.signatures.some((decorated: xdr.DecoratedSignature) => {
    try {
      return (
        decorated.hint().equals(expectedHint) &&
        keypair.verify(hash, decorated.signature())
      );
    } catch {
      return false;
    }
  });
}
