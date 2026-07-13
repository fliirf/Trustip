import type { Enums } from "@trustip/database";

// DB enum aliases (kept in sync with the generated Supabase types).
export type OrderStatus = Enums<"order_status">;
export type PaymentStatus = Enums<"payment_status">;
export type EscrowStatus = Enums<"escrow_status">;
export type NetworkName = Enums<"network">;
export type CheckoutLinkStatus = Enums<"checkout_link_status">;

// ---------------------------------------------------------------------------
// Normalized DB records the payment service reasons about. Amounts are carried
// as canonical decimal strings (not JS numbers) so no precision is lost between
// the DB, the contract, and comparisons.
// ---------------------------------------------------------------------------

export interface OrderRecord {
  id: string;
  status: OrderStatus;
  totalUsdc: string;
  buyerUserId: string | null;
  sellerProfileId: string;
  buyerWalletId: string | null;
  sellerWalletId: string | null;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  status: PaymentStatus;
  amountUsdc: string;
  network: NetworkName;
  payerPublicKey: string | null;
  txHash: string | null;
  ledger: number | null;
  confirmedAt: string | null;
}

export interface EscrowRecord {
  id: string;
  orderId: string;
  status: EscrowStatus;
  contractId: string | null;
  contractOrderId: string | null;
  amountUsdc: string;
  buyerPublicKey: string | null;
  sellerPublicKey: string | null;
  fundedTxHash: string | null;
}

export interface PaymentContext {
  order: OrderRecord;
  payment: PaymentRecord | null;
  escrow: EscrowRecord | null;
  /** Public key bound to the order's buyer wallet, if any. */
  buyerWalletPublicKey: string | null;
  /** Public key bound to the order's seller wallet, if any. */
  sellerWalletPublicKey: string | null;
}

/**
 * Minimal, checkout-link-scoped view used to issue a create-order token. Loaded
 * strictly by PUBLIC identifiers (checkout link slug + order number) — never a
 * raw order UUID — and only for an order that actually belongs to that link. The
 * caller (service) enforces link-active / not-expired / order-payable policy.
 */
export interface CheckoutOrderForIssuance {
  orderId: string;
  orderNo: string;
  orderStatus: OrderStatus;
  totalUsdc: string;
  linkStatus: CheckoutLinkStatus;
  linkExpiresAt: string | null;
}

/**
 * Public checkout-link view used to create an order from a link. Loaded by the
 * PUBLIC slug only; price/seller are server-derived from this record — never
 * from the client.
 */
export interface CheckoutLinkForOrder {
  id: string;
  sellerProfileId: string;
  title: string;
  priceUsdc: string;
  /** Display-only IDR reference price, if the seller configured one. */
  priceIdrReference: string | null;
  status: CheckoutLinkStatus;
  expiresAt: string | null;
  /** False for digital goods with no physical delivery — the order skips the
   * shipment lifecycle and shippingAddress is not required at order-create. */
  requiresShipping: boolean;
}

/**
 * Storage port for the payment service. The Supabase adapter implements this
 * with the service-role client (server-only); unit tests supply an in-memory
 * fake. All money/escrow state changes are idempotent and status-guarded — the
 * client never writes these tables directly (enforced by RLS).
 */
export interface PaymentStore {
  loadByOrderId(orderId: string): Promise<PaymentContext | null>;
  loadByPaymentId(paymentId: string): Promise<PaymentContext | null>;

  /** Load a payable order strictly within its checkout-link context, by PUBLIC
   * codes only (link slug + order_no). Returns null unless an order with that
   * order_no exists AND belongs to a checkout_link with that slug — so a raw
   * order UUID alone can never resolve. Status/expiry policy is the caller's. */
  loadCheckoutOrderForIssuance(input: {
    slug: string;
    orderNo: string;
  }): Promise<CheckoutOrderForIssuance | null>;

  /** Load an order-creatable checkout link by its PUBLIC slug. Status/expiry
   * policy is the caller's (service). */
  loadCheckoutLinkBySlug(slug: string): Promise<CheckoutLinkForOrder | null>;

  /** Resolve the seller's payout wallet (user_wallets id) for the given seller
   * profile on the given network — SERVER-derived, never client input. Must
   * return only a wallet that belongs to the profile's user, is verified, and
   * matches the network; prefer the primary wallet and FAIL CLOSED (null) when
   * none qualifies or the choice is ambiguous. The escrow create_order step
   * later derives the on-chain seller from this wallet. */
  resolveSellerWalletId(input: {
    sellerProfileId: string;
    network: NetworkName;
  }): Promise<string | null>;

  /** Insert a new order (+ its single order_items row carrying buyer contact in
   * metadata) for a checkout link. All money values are SERVER-derived by the
   * service. Returns null when the generated order_no collides with an existing
   * one (unique violation), so the caller can retry with a fresh order_no. */
  insertCheckoutOrder(input: {
    orderNo: string;
    checkoutLinkId: string;
    sellerProfileId: string;
    /** Seller payout wallet resolved via `resolveSellerWalletId` — the escrow
     * step reads `orders.seller_wallet_id` to derive the on-chain seller. */
    sellerWalletId: string;
    /** Copied from the checkout link at creation time so a later link edit
     * never changes an in-flight order's shipment rules. */
    requiresShipping: boolean;
    totalUsdc: string;
    totalIdrReference: string | null;
    item: {
      name: string;
      quantity: number;
      unitPriceUsdc: string;
      subtotalUsdc: string;
      metadata: Record<string, unknown>;
    };
  }): Promise<{ orderId: string; orderNo: string } | null>;

  /** Ensure the order's single payment row exists and is set to
   * awaiting_signature with the given (server-derived) amount/payer/network. */
  preparePaymentRow(input: {
    orderId: string;
    amountUsdc: string;
    network: NetworkName;
    payerPublicKey: string;
  }): Promise<PaymentRecord>;

  /** Ensure the escrow row records the on-chain contract linkage + status. */
  linkEscrowRow(input: {
    orderId: string;
    contractId: string;
    contractOrderId: string;
    amountUsdc: string;
    buyerPublicKey: string;
    sellerPublicKey: string | null;
    onChainStatus: EscrowStatus;
  }): Promise<EscrowRecord>;

  /** Find a payment already associated with a tx hash (duplicate detection). */
  findPaymentByTxHash(txHash: string): Promise<PaymentRecord | null>;

  /** Idempotently record submission: payment→submitted, order→payment_submitted,
   * blockchain_transactions(escrow_fund, submitted). Safe to call repeatedly. */
  recordSubmission(input: {
    paymentId: string;
    orderId: string;
    escrowId: string | null;
    txHash: string;
    sourceAccount: string;
    amountUsdc: string;
    network: NetworkName;
    rawResponse?: unknown;
  }): Promise<void>;

  /** Idempotently record a confirmed fund: payment→confirmed, escrow→funded,
   * order→escrow_locked, blockchain tx→confirmed, escrow_event(fund). Guarded so
   * a repeat call is a no-op. Returns whether it applied the transition. */
  recordFundConfirmed(input: {
    paymentId: string;
    orderId: string;
    escrowId: string;
    txHash: string;
    ledger: number | null;
    buyerPublicKey: string | null;
    amountUsdc: string;
    network: NetworkName;
  }): Promise<{ applied: boolean }>;

  /** Idempotently record an admin/operator `create_order` landing: a
   * blockchain_transactions(escrow_create, confirmed) row + an
   * escrow_events(create) row, both keyed on the create tx hash so a repeat call
   * is a no-op. The escrow row itself is written via `linkEscrowRow`. Never
   * touches payment/order money state. */
  recordEscrowCreationTx(input: {
    escrowId: string;
    orderId: string;
    txHash: string;
    sourceAccount: string;
    amountUsdc: string;
    network: NetworkName;
    ledger: number | null;
    buyerPublicKey: string;
  }): Promise<void>;

  /** Idempotently record a failed submission/verification. Never marks paid. */
  recordFailure(input: {
    paymentId: string;
    txHash: string | null;
    reason: string;
  }): Promise<void>;
}
