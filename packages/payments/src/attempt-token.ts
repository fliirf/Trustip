import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless "prepare attempt" token. Issued by `prepare`, required by `submit`
 * (when a secret is configured). It proves the caller went through a server-side
 * prepare for this exact payment + order, and expires after a short TTL — a
 * defense-in-depth layer on top of the HIGH-1 on-tx binding, without needing a
 * DB column or session. The secret is server-only (never sent to the client).
 */
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface AttemptClaims {
  paymentId: string;
  contractOrderId: string;
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function payloadFor(claims: AttemptClaims, exp: number): string {
  return `${claims.paymentId}:${claims.contractOrderId}:${exp}`;
}

export function createAttemptToken(
  secret: string,
  claims: AttemptClaims,
  now: number = Date.now(),
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const exp = now + ttlMs;
  return `${exp}.${sign(secret, payloadFor(claims, exp))}`;
}

/** Constant-time verification of an attempt token against expected claims. */
export function verifyAttemptToken(
  secret: string,
  token: string,
  claims: AttemptClaims,
  now: number = Date.now(),
): boolean {
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now) return false;
  const expected = sign(secret, payloadFor(claims, exp));
  return safeEqualHex(sig, expected);
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
