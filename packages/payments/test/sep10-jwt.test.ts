import { describe, expect, it } from "vitest";
import {
  createSep10Jwt,
  SEP10_JWT_DEFAULT_TTL_MS,
  verifySep10Jwt,
} from "../src/sep10-jwt.js";

const SECRET = "sep10-jwt-secret";
const ACCOUNT = "GDD4RGXYIEDKCA7YSCBOLUOUCWKKDBNOYFEHZZ5H3QVT7YWDQDLKRGA7";
const ISSUER = "https://trustip.local/api/auth";
const JTI = "a".repeat(64);

const input = { issuer: ISSUER, account: ACCOUNT, jti: JTI };

describe("SEP-10 session JWT", () => {
  it("mints a JWT that verifies and carries the SEP-10 claims", () => {
    const now = Date.now();
    const token = createSep10Jwt(SECRET, input, now);
    expect(token.split(".")).toHaveLength(3);
    const claims = verifySep10Jwt(SECRET, token, now);
    expect(claims).not.toBeNull();
    expect(claims!.sub).toBe(ACCOUNT);
    expect(claims!.iss).toBe(ISSUER);
    expect(claims!.jti).toBe(JTI);
    expect(claims!.exp).toBeGreaterThan(claims!.iat);
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSep10Jwt(SECRET, input);
    expect(verifySep10Jwt("other-secret", token)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = createSep10Jwt(SECRET, input);
    const [h, , s] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...input, sub: "GATTACKER", iat: 1, exp: 9999999999 }),
    ).toString("base64url");
    expect(verifySep10Jwt(SECRET, `${h}.${forged}.${s}`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const past = Date.now() - SEP10_JWT_DEFAULT_TTL_MS - 1000;
    const token = createSep10Jwt(SECRET, input, past);
    expect(verifySep10Jwt(SECRET, token)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifySep10Jwt(SECRET, "not.a.jwt")).toBeNull();
    expect(verifySep10Jwt(SECRET, "onlyonepart")).toBeNull();
    expect(verifySep10Jwt(SECRET, "")).toBeNull();
  });
});
