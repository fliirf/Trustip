import type { Enums } from "@trustip/database";

// DB enum aliases (kept in sync with the generated Supabase types).
export type OrderStatus = Enums<"order_status">;
export type PaymentStatus = Enums<"payment_status">;
export type EscrowStatus = Enums<"escrow_status">;
export type NetworkName = Enums<"network">;

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
 * Storage port for the payment service. The Supabase adapter implements this
 * with the service-role client (server-only); unit tests supply an in-memory
 * fake. All money/escrow state changes are idempotent and status-guarded — the
 * client never writes these tables directly (enforced by RLS).
 */
export interface PaymentStore {
  loadByOrderId(orderId: string): Promise<PaymentContext | null>;
  loadByPaymentId(paymentId: string): Promise<PaymentContext | null>;

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
