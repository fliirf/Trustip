import { describe, expect, it } from "vitest";
import {
  type CheckoutTokenClaims,
  createCheckoutToken,
  verifyCheckoutToken,
} from "../src/checkout-token.js";

const SECRET = "checkout-secret";
const TESTNET = "Test SDF Network ; September 2015";
const MAINNET = "Public Global Stellar Network ; September 2015";
const BUYER = "GDD4RGXYIEDKCA7YSCBOLUOUCWKKDBNOYFEHZZ5H3QVT7YWDQDLKRGA7";
const OTHER_BUYER = "GAYLGJXBBND7YLIWQLVYXY6ZFRJLBFFWUCIJS6CJL3SIPAYEYUBRFBCJ";
const ORDER_HEX = "a".repeat(64);

const CLAIMS: CheckoutTokenClaims = {
  orderId: "order-1",
  buyerPublicKey: BUYER,
  contractOrderId: ORDER_HEX,
  networkPassphrase: TESTNET,
};

describe("checkout-token", () => {
  it("verifies a freshly issued token against matching claims", () => {
    const token = createCheckoutToken(SECRET, CLAIMS);
    expect(verifyCheckoutToken(SECRET, token, CLAIMS)).toBe(true);
  });

  it("rejects a token verified with the wrong secret", () => {
    const token = createCheckoutToken(SECRET, CLAIMS);
    expect(verifyCheckoutToken("other-secret", token, CLAIMS)).toBe(false);
  });

  it("rejects a token bound to a different buyer", () => {
    const token = createCheckoutToken(SECRET, CLAIMS);
    expect(
      verifyCheckoutToken(SECRET, token, {
        ...CLAIMS,
        buyerPublicKey: OTHER_BUYER,
      }),
    ).toBe(false);
  });

  it("rejects a token bound to a different order", () => {
    const token = createCheckoutToken(SECRET, CLAIMS);
    expect(
      verifyCheckoutToken(SECRET, token, { ...CLAIMS, orderId: "order-2" }),
    ).toBe(false);
  });

  it("rejects a token bound to a different contract order id", () => {
    const token = createCheckoutToken(SECRET, CLAIMS);
    expect(
      verifyCheckoutToken(SECRET, token, {
        ...CLAIMS,
        contractOrderId: "b".repeat(64),
      }),
    ).toBe(false);
  });

  it("rejects a token bound to a different network", () => {
    const token = createCheckoutToken(SECRET, CLAIMS);
    expect(
      verifyCheckoutToken(SECRET, token, {
        ...CLAIMS,
        networkPassphrase: MAINNET,
      }),
    ).toBe(false);
  });

  it("rejects an expired token", () => {
    const issuedAt = Date.now() - 30 * 60 * 1000; // 30 min ago
    const token = createCheckoutToken(SECRET, CLAIMS, issuedAt, 15 * 60 * 1000);
    expect(verifyCheckoutToken(SECRET, token, CLAIMS)).toBe(false);
  });

  it("accepts a token that is still within its TTL", () => {
    const issuedAt = Date.now() - 5 * 60 * 1000; // 5 min ago
    const token = createCheckoutToken(SECRET, CLAIMS, issuedAt, 15 * 60 * 1000);
    expect(verifyCheckoutToken(SECRET, token, CLAIMS)).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const token = createCheckoutToken(SECRET, CLAIMS);
    const [exp, sig] = token.split(".");
    const flipped = sig!.slice(0, -1) + (sig!.endsWith("0") ? "1" : "0");
    expect(verifyCheckoutToken(SECRET, `${exp}.${flipped}`, CLAIMS)).toBe(
      false,
    );
  });

  it("rejects a malformed token", () => {
    expect(verifyCheckoutToken(SECRET, "", CLAIMS)).toBe(false);
    expect(verifyCheckoutToken(SECRET, "no-dot", CLAIMS)).toBe(false);
    expect(verifyCheckoutToken(SECRET, ".abc", CLAIMS)).toBe(false);
    expect(verifyCheckoutToken(SECRET, "notanumber.abc", CLAIMS)).toBe(false);
  });
});
