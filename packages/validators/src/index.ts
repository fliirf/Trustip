import { z } from "zod";

export const createOrderSchema = z.object({
  checkoutLinkId: z.string().uuid(),
  buyerEmail: z.string().email(),
  buyerName: z.string().min(1),
  quantity: z.number().int().positive(),
  /** Omitted for a no-shipping (digital goods) checkout link; the service
   * enforces presence when the link actually requires shipping. */
  shippingAddress: z
    .object({
      name: z.string().min(1),
      phone: z.string().min(5),
      addressLine1: z.string().min(1),
      city: z.string().min(1),
      postalCode: z.string().min(3),
      country: z.string().length(2),
    })
    .optional(),
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
/** Wallet-ownership challenge issuance (SEP-10 hardening). SHAPE only — the
 * challenge is server-built for the given key; no store read happens. */
export const issueCheckoutChallengeSchema = z.object({
  slug: checkoutSlugSchema,
  orderNo: orderNoSchema,
  buyerPublicKey: stellarPublicKeySchema,
  networkPassphrase: networkPassphraseSchema,
});
export type IssueCheckoutChallengeInput = z.infer<
  typeof issueCheckoutChallengeSchema
>;

export const issueCheckoutTokenSchema = z.object({
  slug: checkoutSlugSchema,
  orderNo: orderNoSchema,
  buyerPublicKey: stellarPublicKeySchema,
  networkPassphrase: networkPassphraseSchema,
  // SEP-10 proof: challenge signed by the buyer wallet + its issuance token.
  signedChallengeXdr: signedXdrSchema,
  challengeToken: z.string().min(1).max(1024),
});
export type IssueCheckoutTokenInput = z.infer<typeof issueCheckoutTokenSchema>;

/** SEP-10 Web Auth (Roadmap A2). GET challenge query + POST token body. SHAPE
 * only — the server signs/verifies the challenge and issues the JWT. */
export const sep10ChallengeQuerySchema = z.object({
  account: stellarPublicKeySchema,
  home_domain: z.string().max(255).optional(),
});
export type Sep10ChallengeQuery = z.infer<typeof sep10ChallengeQuerySchema>;

export const sep10TokenSchema = z.object({
  transaction: signedXdrSchema,
});
export type Sep10TokenInput = z.infer<typeof sep10TokenSchema>;

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

/** Decimal USDC amount string, up to 7 decimals. Positivity and canonical form
 * are enforced server-side via integer-unit parsing. */
export const usdcAmountSchema = z
  .string()
  .trim()
  .regex(/^\d{1,13}(\.\d{1,7})?$/, "invalid USDC amount");

/** Seller checkout link creation (Phase 7C). SHAPE only — sellerProfileId and
 * status are always server-derived; the client cannot set link/order/payment
 * state. Custom slug is optional (server generates when omitted). */
export const createSellerCheckoutLinkSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500).optional(),
  priceUsdc: usdcAmountSchema,
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,60}$/, "slug may use a-z, 0-9 and dashes (3-60)")
    .optional(),
  /** False for digital goods with no physical delivery (game top-ups, etc.) —
   * skips the processing/packed/shipped lifecycle entirely. Defaults true. */
  requiresShipping: z.boolean().optional(),
});
export type CreateSellerCheckoutLinkInput = z.infer<
  typeof createSellerCheckoutLinkSchema
>;

/** Seller shipment lifecycle statuses (Phase 8A + no-shipping use case).
 * `processing`/`packed`/`shipped` are the physical-goods forward states.
 * `delivered` is a direct seller-settable target ONLY for a no-shipping
 * (digital goods) order — enforced server-side, not by this schema.
 * `completed`/`release` are never seller-settable (buyer-confirmed only). */
export const SHIPMENT_UPDATE_STATUSES = [
  "processing",
  "packed",
  "shipped",
  "delivered",
] as const;
export type ShipmentUpdateStatus = (typeof SHIPMENT_UPDATE_STATUSES)[number];

/** Seller shipment update (Phase 8A). SHAPE only — ownership, transition
 * legality, and the escrow-funded precondition are enforced server-side.
 * Unknown keys are stripped: a client can never smuggle paid/funded/released. */
export const updateShipmentStatusSchema = z.object({
  status: z.enum(SHIPMENT_UPDATE_STATUSES),
  courier: z.string().trim().min(1).max(60).optional(),
  trackingNumber: z.string().trim().min(3).max(80).optional(),
  note: z.string().trim().min(1).max(500).optional(),
});
export type UpdateShipmentStatusInput = z.infer<
  typeof updateShipmentStatusSchema
>;

/** Buyer confirm-received challenge issuance (RELEASE-1). SHAPE only — the
 * buyer wallet is server-derived from the funded escrow, never client input. */
export const confirmReceivedChallengeSchema = z.object({
  networkPassphrase: networkPassphraseSchema,
});
export type ConfirmReceivedChallengeInput = z.infer<
  typeof confirmReceivedChallengeSchema
>;

/** Buyer confirm-received + release (RELEASE-1). SHAPE only — every release
 * precondition (buyer signature, statuses, on-chain state) is enforced
 * server-side; the client can never name an amount, wallet, or status. */
export const confirmReceivedSchema = z.object({
  signedChallengeXdr: signedXdrSchema,
  challengeToken: z.string().min(1).max(512),
  networkPassphrase: networkPassphraseSchema,
});
export type ConfirmReceivedInput = z.infer<typeof confirmReceivedSchema>;

/** Refund reason codes — mirrors the `refund_reason_code` DB enum. */
export const refundReasonCodeSchema = z.enum([
  "not_received",
  "wrong_item",
  "damaged",
  "fake",
  "seller_unresponsive",
  "other",
]);
export type RefundReasonCode = z.infer<typeof refundReasonCodeSchema>;

/** Buyer refund request (REFUND-1). SHAPE only — eligibility (order state,
 * escrow funded, no open refund) is enforced server-side; the client can never
 * name an amount or a destination: an on-chain refund can only ever go back to
 * the funding buyer wallet, decided by an admin. */
export const createRefundRequestSchema = z.object({
  reasonCode: refundReasonCodeSchema,
  description: z.string().trim().min(1).max(2000).optional(),
});
export type CreateRefundRequestInput = z.infer<
  typeof createRefundRequestSchema
>;

/** Admin refund resolution (REFUND-2). SHAPE only — admin authority, refund
 * state, and on-chain truth are all enforced server-side. */
export const resolveRefundSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().min(1).max(2000).optional(),
});
export type ResolveRefundInput = z.infer<typeof resolveRefundSchema>;

export const refundRequestIdSchema = z.string().uuid();

/** Refund evidence kinds — mirrors the `evidence_type` DB enum. */
export const refundEvidenceTypeSchema = z.enum([
  "unboxing_video",
  "chat_screenshot",
  "shipping_receipt",
  "item_photo",
  "other",
]);
export type RefundEvidenceTypeInput = z.infer<typeof refundEvidenceTypeSchema>;

/** Buyer review of a completed order (Trust Profile & Reviews). SHAPE only —
 * eligibility (order completed, one per order) is enforced server-side; the
 * client can never name the seller or the order's outcome. */
export const submitReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(500).optional(),
});
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
