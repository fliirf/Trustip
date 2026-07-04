import { z } from "zod";

export const createOrderSchema = z.object({
  checkoutLinkId: z.string().uuid(),
  buyerEmail: z.string().email(),
  buyerName: z.string().min(1),
  quantity: z.number().int().positive(),
  shippingAddress: z.object({
    name: z.string().min(1),
    phone: z.string().min(5),
    addressLine1: z.string().min(1),
    city: z.string().min(1),
    postalCode: z.string().min(3),
    country: z.string().length(2),
  }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * Payout method values as exposed in API payloads (uppercase), matching the
 * canonical names used across CLAUDE.md, the API spec, and the ERD.
 */
export const PAYOUT_METHOD_VALUES = [
  "USDC_WALLET",
  "XLM_WALLET",
  "MONEYGRAM_CASHOUT",
] as const;

export type PayoutMethod = (typeof PAYOUT_METHOD_VALUES)[number];

/**
 * Maps an uppercase API payout method to its lowercase database value.
 * Database/enum values stay lowercase; API payloads use uppercase.
 */
export const PAYOUT_METHOD_DB_VALUE: Record<PayoutMethod, string> = {
  USDC_WALLET: "usdc_wallet",
  XLM_WALLET: "xlm_wallet",
  MONEYGRAM_CASHOUT: "moneygram_cashout",
};

export function toPayoutMethodDbValue(method: PayoutMethod): string {
  return PAYOUT_METHOD_DB_VALUE[method];
}

export const addPayoutMethodSchema = z.object({
  methodType: z.enum(PAYOUT_METHOD_VALUES),
  label: z.string().min(1),
  stellarAddress: z.string().optional(),
  cashoutCountry: z.string().optional(),
  cashoutCurrency: z.string().optional(),
  preferredName: z.string().optional(),
  phone: z.string().optional(),
});

export type AddPayoutMethodInput = z.infer<typeof addPayoutMethodSchema>;

// ---------------------------------------------------------------------------
// Payment API schemas (Phase 4 — payment backend prepare/submit/sync/status).
// These validate request SHAPE only. Trust boundaries (amount, payment status,
// on-chain state) are enforced server-side against the DB + Stellar — never the
// client. Notably: no `amount` or `status` field is accepted from the client.
// ---------------------------------------------------------------------------

/** Stellar ed25519 public key (G... strkey). Strict strkey validation runs
 * server-side via @trustip/stellar; this is a cheap shape gate. */
export const stellarPublicKeySchema = z
  .string()
  .regex(/^G[A-Z2-7]{55}$/, "invalid Stellar public key");

/** Signed transaction XDR (base64). Bounded to avoid oversized payloads. */
export const signedXdrSchema = z.string().min(1).max(65536);

/** Stellar network passphrase. Required — the server rejects any value that is
 * not the active network (fail closed). */
export const networkPassphraseSchema = z.string().min(1).max(120);

export const preparePaymentSchema = z.object({
  orderId: z.string().uuid(),
  buyerPublicKey: stellarPublicKeySchema,
  networkPassphrase: networkPassphraseSchema,
});
export type PreparePaymentInput = z.infer<typeof preparePaymentSchema>;

export const submitPaymentSchema = z.object({
  paymentId: z.string().uuid(),
  signedXdr: signedXdrSchema,
  networkPassphrase: networkPassphraseSchema,
  /** Attempt token issued by prepare; required when the server configures a
   * PAYMENT_ATTEMPT_SECRET. */
  attemptToken: z.string().min(1).max(512).optional(),
});
export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>;

export const syncPaymentSchema = z.object({
  paymentId: z.string().uuid(),
});
export type SyncPaymentInput = z.infer<typeof syncPaymentSchema>;

/**
 * Escrow create_order orchestration (Phase 4.1). Admin/operator-authorized,
 * runs after the buyer connects a wallet and before fund prepare/submit. SHAPE
 * only: no amount/status/seller from the client — all are server-derived from
 * the order and validated on-chain.
 */
export const createEscrowOrderSchema = z.object({
  orderId: z.string().uuid(),
  buyerPublicKey: stellarPublicKeySchema,
  networkPassphrase: networkPassphraseSchema,
  /** Short-lived server-signed checkout token authorizing this buyer↔order for
   * guest checkout. Required when unauthenticated and the server configures a
   * TRUSTIP_CHECKOUT_TOKEN_SECRET; carries no amount/status/seller. */
  checkoutToken: z.string().min(1).max(512).optional(),
});
export type CreateEscrowOrderInput = z.infer<typeof createEscrowOrderSchema>;

/** Public checkout link slug (URL-safe unreserved chars). */
export const checkoutSlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9._~-]+$/, "invalid checkout slug");

/** Public order number (never a raw order UUID). */
export const orderNoSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "invalid order number");

/**
 * Checkout token issuance (Phase 5.0). Guest checkout requests a short-lived
 * create-order token from a CHECKOUT-LINK context (public slug + order number)
 * after connecting a wallet. SHAPE only: no amount/status/seller/recipient is
 * accepted (unknown keys are stripped) — all authority is server-derived and
 * verified on-chain downstream.
 */
export const issueCheckoutTokenSchema = z.object({
  slug: checkoutSlugSchema,
  orderNo: orderNoSchema,
  buyerPublicKey: stellarPublicKeySchema,
  networkPassphrase: networkPassphraseSchema,
});
export type IssueCheckoutTokenInput = z.infer<typeof issueCheckoutTokenSchema>;

// ---------------------------------------------------------------------------
// Seller onboarding (Phase 7B). SHAPE only — ownership, role, network policy,
// and `verified_at` are enforced server-side. The client can NEVER submit
// `verified_at`, `is_primary` truth, or any payment/escrow state.
// ---------------------------------------------------------------------------

/** Network name as stored in the DB enum. The server still rejects anything
 * that is not its configured network (fail closed). */
export const networkNameSchema = z.enum(["testnet", "mainnet"]);

export const sellerProfileSchema = z.object({
  storeName: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80).optional(),
  socialUrl: z.string().trim().url().max(300).optional(),
});
export type SellerProfileInput = z.infer<typeof sellerProfileSchema>;

export const registerSellerWalletSchema = z.object({
  walletProvider: z.enum(["freighter", "xbull"]),
  publicKey: stellarPublicKeySchema,
  network: networkNameSchema,
});
export type RegisterSellerWalletInput = z.infer<
  typeof registerSellerWalletSchema
>;

export const createWalletChallengeSchema = z.object({
  publicKey: stellarPublicKeySchema,
  network: networkNameSchema,
});
export type CreateWalletChallengeInput = z.infer<
  typeof createWalletChallengeSchema
>;

export const verifyWalletChallengeSchema = z.object({
  publicKey: stellarPublicKeySchema,
  network: networkNameSchema,
  signedXdr: signedXdrSchema,
  /** Server-issued challenge token returned by /challenge (HMAC, short TTL). */
  challengeToken: z.string().min(1).max(1024),
});
export type VerifyWalletChallengeInput = z.infer<
  typeof verifyWalletChallengeSchema
>;

export const setPrimaryWalletSchema = z.object({
  walletId: z.string().uuid(),
});
export type SetPrimaryWalletInput = z.infer<typeof setPrimaryWalletSchema>;
