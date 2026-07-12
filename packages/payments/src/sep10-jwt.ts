import { createHmac, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// SEP-10 session JWT (Roadmap A2). After a client proves control of a Stellar
// account (signed challenge verified), the auth endpoint issues a short-lived
// HS256 JWT. Minimal, dependency-free (node:crypto) — server-only.
//
// Claims follow SEP-10: `iss` (this server), `sub` (the authenticated G...
// account), `iat`, `exp`, and `jti` (the challenge tx hash, single-use id).
// ---------------------------------------------------------------------------

export const SEP10_JWT_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface Sep10JwtClaims {
  /** Issuer — the web-auth endpoint URL. */
  iss: string;
  /** Subject — the authenticated Stellar account (G...). */
  sub: string;
  /** Issued-at (seconds since epoch). */
  iat: number;
  /** Expiry (seconds since epoch). */
  exp: number;
  /** Challenge transaction hash (hex) — unique per challenge. */
  jti: string;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(secret: string, signingInput: string): string {
  return createHmac("sha256", secret).update(signingInput).digest("base64url");
}

export interface CreateSep10JwtInput {
  /** iss — the web-auth endpoint URL. */
  issuer: string;
  /** sub — the authenticated account (G...). */
  account: string;
  /** jti — the challenge tx hash. */
  jti: string;
}

/** Mint an HS256 JWT for a verified SEP-10 account. */
export function createSep10Jwt(
  secret: string,
  input: CreateSep10JwtInput,
  now: number = Date.now(),
  ttlMs: number = SEP10_JWT_DEFAULT_TTL_MS,
): string {
  const iat = Math.floor(now / 1000);
  const exp = Math.floor((now + ttlMs) / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const claims: Sep10JwtClaims = {
    iss: input.issuer,
    sub: input.account,
    iat,
    exp,
    jti: input.jti,
  };
  const payload = b64url(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${sign(secret, signingInput)}`;
}

/** Verify an HS256 SEP-10 JWT. Returns the claims when the signature is valid
 * and the token is unexpired; null for anything malformed/tampered/expired
 * (never throws). Constant-time signature comparison. */
export function verifySep10Jwt(
  secret: string,
  token: string,
  now: number = Date.now(),
): Sep10JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts as [string, string, string];

  const expected = sign(secret, `${header}.${payload}`);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  let claims: Sep10JwtClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof claims.exp !== "number" || claims.exp * 1000 < now) return null;
  if (typeof claims.sub !== "string" || !claims.sub) return null;
  return claims;
}
