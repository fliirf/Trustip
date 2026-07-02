import { describe, expect, it } from "vitest";
import {
  createAttemptToken,
  verifyAttemptToken,
} from "../src/attempt-token.js";

const SECRET = "server-only-secret";
const claims = { paymentId: "pay-1", contractOrderId: "a".repeat(64) };

describe("attempt token", () => {
  it("verifies a freshly issued token", () => {
    const token = createAttemptToken(SECRET, claims);
    expect(verifyAttemptToken(SECRET, token, claims)).toBe(true);
  });

  it("rejects a token issued for different claims", () => {
    const token = createAttemptToken(SECRET, claims);
    expect(
      verifyAttemptToken(SECRET, token, { ...claims, paymentId: "pay-2" }),
    ).toBe(false);
    expect(
      verifyAttemptToken(SECRET, token, {
        ...claims,
        contractOrderId: "b".repeat(64),
      }),
    ).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const token = createAttemptToken(SECRET, claims);
    expect(verifyAttemptToken("other-secret", token, claims)).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const token = createAttemptToken(SECRET, claims);
    const tampered = token.endsWith("0")
      ? `${token.slice(0, -1)}1`
      : `${token.slice(0, -1)}0`;
    expect(verifyAttemptToken(SECRET, tampered, claims)).toBe(false);
  });

  it("rejects an expired token", () => {
    const t0 = 1_000_000;
    const token = createAttemptToken(SECRET, claims, t0, 1000);
    expect(verifyAttemptToken(SECRET, token, claims, t0 + 500)).toBe(true);
    expect(verifyAttemptToken(SECRET, token, claims, t0 + 2000)).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(verifyAttemptToken(SECRET, "garbage", claims)).toBe(false);
    expect(verifyAttemptToken(SECRET, "", claims)).toBe(false);
    expect(verifyAttemptToken(SECRET, ".abc", claims)).toBe(false);
  });
});
