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
});
export type CreateEscrowOrderInput = z.infer<typeof createEscrowOrderSchema>;
