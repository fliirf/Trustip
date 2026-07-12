import { Keypair, Transaction, WebAuth } from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// SEP-10 Stellar Web Authentication (Roadmap A2).
//
// Thin, server-only wrapper over the SDK's spec-exact WebAuth helpers — we do
// NOT reimplement the challenge crypto. `buildSep10Challenge` handles the
// operator/server SECRET, so it must only ever run server-side (no node
// builtins here, so this module stays importable from the client-safe stellar
// package without bundling secrets — callers keep it server-side).
//
// This is distinct from `wallet-challenge.ts`: that is Trustip's internal
// ownership-proof (manageData nonce, throwaway source). This is the STANDARD
// SEP-10 flow (server-signed challenge, home_domain/web_auth_domain ops) that
// any third-party Stellar wallet or SEP-10 client recognizes.
// ---------------------------------------------------------------------------

/** SEP-10 challenges are short-lived — signing is one interactive wallet step. */
export const SEP10_CHALLENGE_TIMEOUT_SECS = 300; // 5 minutes

export interface BuildSep10ChallengeParams {
  /** Server signing SECRET (S...) — the account published as stellar.toml
   * SIGNING_KEY. Server-only. */
  serverSigningSecret: string;
  /** Client account (G...) proving ownership. */
  clientAccount: string;
  /** Domain hosting stellar.toml (e.g. "trustip.app" or "localhost:3000"). */
  homeDomain: string;
  /** Domain serving the web-auth endpoint (usually same as homeDomain). */
  webAuthDomain: string;
  networkPassphrase: string;
  timeoutSecs?: number;
}

/** Build a server-signed SEP-10 challenge transaction (base64 XDR) for the
 * client to sign. Throws on an invalid server secret / client account. */
export function buildSep10Challenge(p: BuildSep10ChallengeParams): string {
  const serverKeypair = Keypair.fromSecret(p.serverSigningSecret);
  return WebAuth.buildChallengeTx(
    serverKeypair,
    p.clientAccount,
    p.homeDomain,
    p.timeoutSecs ?? SEP10_CHALLENGE_TIMEOUT_SECS,
    p.networkPassphrase,
    p.webAuthDomain,
  );
}

export interface VerifySep10ChallengeParams {
  /** The signed challenge XDR returned by the client. */
  challengeXdr: string;
  /** Server SIGNING_KEY public account (G...). */
  serverAccountId: string;
  homeDomain: string | string[];
  webAuthDomain: string;
  networkPassphrase: string;
}

export interface VerifiedSep10Challenge {
  /** The client account whose signature was verified. */
  account: string;
  /** Challenge transaction hash (hex) — a unique id, used as the JWT `jti`. */
  jti: string;
}

/**
 * Verify a signed SEP-10 challenge. Delegates to the SDK for the spec checks:
 * `readChallengeTx` validates structure + server signature + timebounds (throws
 * when expired/malformed); `verifyChallengeTxSigners` confirms the client
 * account actually signed. Returns the verified account + challenge hash, or
 * throws for anything invalid.
 */
export function verifySep10Challenge(
  p: VerifySep10ChallengeParams,
): VerifiedSep10Challenge {
  const read = WebAuth.readChallengeTx(
    p.challengeXdr,
    p.serverAccountId,
    p.networkPassphrase,
    p.homeDomain,
    p.webAuthDomain,
  );
  const signers = WebAuth.verifyChallengeTxSigners(
    p.challengeXdr,
    p.serverAccountId,
    p.networkPassphrase,
    [read.clientAccountID],
    p.homeDomain,
    p.webAuthDomain,
  );
  if (!signers.includes(read.clientAccountID)) {
    throw new Error("challenge is not signed by the client account");
  }
  const tx = read.tx as Transaction;
  return { account: read.clientAccountID, jti: tx.hash().toString("hex") };
}
