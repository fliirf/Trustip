import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless "checkout / create-order" authorization token. Issued SERVER-SIDE at
 * the trusted point where a buyer opens a checkout (the checkout backend knows
 * this buyer key belongs to this order), and required by the admin/operator
 * `create_order` step (POST /api/escrows/create-order) for guest checkout.
 *
 * It binds the exact {orderId, buyerPublicKey, contractOrderId, network} tuple
 * and expires after a short TTL, so an anonymous stranger holding only a raw
 * orderId + arbitrary buyer key CANNOT force operator signing (which spends
 * operator XLM fees). The secret is server-only and never sent to the client;
 * the token carries no amount/status/seller — those stay server-derived and are
 * verified on-chain regardless. This is the create-order analogue of the
 * prepare→submit attempt token, with a distinct secret and claim set.
 */
/** Default (and recommended) checkout-token lifetime. Short by design: a buyer
 * connects a wallet and calls create-order within a couple of minutes. Exported
 * so the issuance path can report a matching `expiresAt` from one source. */
export const CHECKOUT_TOKEN_DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface CheckoutTokenClaims {
  orderId: string;
  buyerPublicKey: string;
  /** Deterministic on-chain order id (hex) derived from orderId; bound for
   * defense-in-depth so the token is unusable against a different escrow. */
  contractOrderId: string;
  networkPassphrase: string;
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function payloadFor(claims: CheckoutTokenClaims, exp: number): string {
  // Domain-separated (`checkout:v1`) so a checkout token can never be confused
  // with any other HMAC token type, even under a shared secret.
  return [
    "checkout:v1",
    claims.orderId,
    claims.buyerPublicKey,
    claims.contractOrderId,
    claims.networkPassphrase,
    exp,
  ].join(":");
}

export function createCheckoutToken(
  secret: string,
  claims: CheckoutTokenClaims,
  now: number = Date.now(),
  ttlMs: number = CHECKOUT_TOKEN_DEFAULT_TTL_MS,
): string {
  const exp = now + ttlMs;
  return `${exp}.${sign(secret, payloadFor(claims, exp))}`;
}

/** Constant-time verification of a checkout token against expected claims.
 * Returns false (never throws) for any malformed/expired/mismatched token. */
export function verifyCheckoutToken(
  secret: string,
  token: string,
  claims: CheckoutTokenClaims,
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
