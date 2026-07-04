import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Stateless HMAC token for seller wallet-ownership challenges. Issued alongside
 * the challenge transaction (POST /api/seller/wallets/challenge) and required
 * by verify. It binds {userId, walletPublicKey, networkPassphrase, nonce} and
 * expires quickly, so a signed challenge cannot be replayed by another user,
 * for another key, on another network, or after the window closes. The nonce
 * inside the token must match the manageData nonce in the signed transaction.
 * Domain-separated (`wallet-verify:v1`) from every other Trustip HMAC token.
 */
export const WALLET_CHALLENGE_DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface WalletChallengeClaims {
  userId: string;
  walletPublicKey: string;
  networkPassphrase: string;
}

/** 24 random bytes as hex (48 chars) — fits manageData's 64-byte limit. */
export function generateChallengeNonce(): string {
  return randomBytes(24).toString("hex");
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function payloadFor(
  claims: WalletChallengeClaims,
  nonce: string,
  exp: number,
): string {
  return [
    "wallet-verify:v1",
    claims.userId,
    claims.walletPublicKey,
    claims.networkPassphrase,
    nonce,
    exp,
  ].join(":");
}

/** Token format: `${exp}.${nonce}.${hmac}` — nonce travels inside the token so
 * verification is fully stateless. */
export function createWalletChallengeToken(
  secret: string,
  claims: WalletChallengeClaims,
  nonce: string,
  now: number = Date.now(),
  ttlMs: number = WALLET_CHALLENGE_DEFAULT_TTL_MS,
): string {
  const exp = now + ttlMs;
  return `${exp}.${nonce}.${sign(secret, payloadFor(claims, nonce, exp))}`;
}

/** Constant-time verification against expected claims. Returns the bound nonce
 * when valid, null for anything malformed/expired/mismatched (never throws). */
export function verifyWalletChallengeToken(
  secret: string,
  token: string,
  claims: WalletChallengeClaims,
  now: number = Date.now(),
): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [expStr, nonce, sig] = parts as [string, string, string];
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now) return null;
  if (!nonce) return null;
  const expected = sign(secret, payloadFor(claims, nonce, exp));
  return safeEqualHex(sig, expected) ? nonce : null;
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
