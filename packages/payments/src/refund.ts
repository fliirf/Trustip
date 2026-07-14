import { type EscrowGateway, OperatorSignerError } from "@trustip/stellar";
import { PaymentError } from "./errors.js";
import { usdcToUnits } from "./money.js";
import type { NetworkName } from "./ports.js";
import type { ReleaseStore } from "./release.js";
import type { PaymentActor } from "./service.js";

// ---------------------------------------------------------------------------
// REFUND-1 — buyer refund request, REFUND-2 — admin resolution.
//
// A refund request never moves money: it only freezes release (the existing
// `hasOpenRefundRequest` guard in RELEASE-1) until an admin decides. The ONLY
// path that moves money is the admin-approved on-chain `refund_to_buyer`,
// which the contract can send nowhere except the funding buyer wallet.
//
// ponytail: the buyer request is authorized by possession of (slug, order_no)
// only — no wallet signature. Worst case a slug+order_no holder (= the seller)
// files a fake request, which merely freezes the seller's own release until an
// admin reviews it. Add the wallet-challenge proof (see release.ts) if abuse
// ever shows up.
// ---------------------------------------------------------------------------

export type RefundReasonCode =
  | "not_received"
  | "wrong_item"
  | "damaged"
  | "fake"
  | "seller_unresponsive"
  | "other";

export interface RefundRequestRecord {
  id: string;
  orderId: string;
  orderNo: string;
  status: string;
  decision: string;
  reasonCode: RefundReasonCode;
  description: string | null;
  requestedAmountUsdc: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** Admin list row: the request plus just enough order context to decide. */
export interface AdminRefundRow extends RefundRequestRecord {
  sellerProfileId: string;
  orderStatus: string;
  escrowStatus: string | null;
  amountUsdc: string | null;
  shipmentStatus: string | null;
}

/** Everything the admin resolution guards need about one refund request. */
export interface RefundResolutionContext {
  refund: {
    id: string;
    status: string;
    decision: string;
  };
  orderId: string;
  orderNo: string;
  orderStatus: string;
  escrow: {
    id: string;
    status: string;
    contractOrderId: string | null;
    buyerPublicKey: string | null;
    amountUsdc: string;
    refundTxHash: string | null;
  } | null;
}

export interface RefundStore
  extends Pick<ReleaseStore, "loadReleaseContext"> {
  /** Insert the refund request (seller_profile_id / requested amount are
   * resolved server-side from the order — never client input) and append the
   * buyer 'refund_requested' order_status_events row. orders.status itself is
   * untouched: `hasOpenRefundRequest` is the single release freeze. */
  createRefundRequest(input: {
    orderId: string;
    reasonCode: RefundReasonCode;
    description: string | null;
  }): Promise<RefundRequestRecord>;

  listAdminRefunds(input: { onlyOpen: boolean }): Promise<AdminRefundRow[]>;

  loadRefundResolutionContext(
    refundRequestId: string,
  ): Promise<RefundResolutionContext | null>;

  /** status → rejected, decision → release_seller, resolved_at; plus the
   * admin_actions audit row. Guarded: applied=false unless still open. */
  markRefundRejected(input: {
    refundRequestId: string;
    adminUserId: string;
    note: string | null;
  }): Promise<{ applied: boolean }>;

  /** status → approved + admin_actions audit row BEFORE the on-chain refund,
   * so a crash mid-refund leaves a heal-able 'approved' state. Guarded. */
  markRefundApproved(input: {
    refundRequestId: string;
    adminUserId: string;
    note: string | null;
  }): Promise<{ applied: boolean }>;

  /** Idempotently record a submitted (not yet confirmed) refund tx. */
  recordRefundSubmitted(input: {
    orderId: string;
    escrowId: string;
    txHash: string;
    sourceAccount: string;
    amountUsdc: string;
    network: NetworkName;
  }): Promise<void>;

  /** Latest known escrow_refund tx hash for the order, for the heal path. */
  findRefundTxHash(orderId: string): Promise<string | null>;

  /** Atomic chain-verified refund record (confirm_refunded_payment RPC). */
  confirmRefunded(input: {
    orderId: string;
    escrowId: string;
    refundRequestId: string;
    txHash: string;
    ledger: number | null;
    toPublicKey: string | null;
    amountUsdc: string;
    network: NetworkName;
  }): Promise<{ applied: boolean }>;
}

export interface RefundDeps {
  store: RefundStore;
  gateway: EscrowGateway;
  config: {
    networkName: NetworkName;
  };
}

const notFound = () => new PaymentError("CheckoutNotFound", "order not found");

// --- REFUND-1: buyer files a refund request ----------------------------------

export interface CreateRefundRequestInput {
  slug: string;
  orderNo: string;
  reasonCode: RefundReasonCode;
  description?: string;
}

/**
 * Create a refund request for a publicly-addressed order. Eligible = payment
 * confirmed + escrow funded (money is actually locked) + order not terminal +
 * no other open refund. Ineligible/missing orders share one generic 404.
 */
export async function createRefundRequest(
  deps: RefundDeps,
  input: CreateRefundRequestInput,
): Promise<RefundRequestRecord> {
  const ctx = await deps.store.loadReleaseContext({
    slug: input.slug,
    orderNo: input.orderNo,
  });
  if (!ctx || !ctx.escrow) throw notFound();
  if (ctx.hasOpenRefundRequest) {
    throw new PaymentError(
      "Conflict",
      "a refund request is already open for this order",
    );
  }
  if (ctx.paymentStatus !== "confirmed" || ctx.escrow.status !== "funded") {
    // Nothing is escrowed (yet, or anymore) — nothing to refund.
    throw notFound();
  }
  if (["completed", "refunded", "cancelled", "failed"].includes(ctx.orderStatus)) {
    throw notFound();
  }

  return deps.store.createRefundRequest({
    orderId: ctx.orderId,
    reasonCode: input.reasonCode,
    description: input.description?.trim() || null,
  });
}

// --- REFUND-2: admin resolution ------------------------------------------------

function requireAdmin(actor: PaymentActor): string {
  if (!actor.userId || !actor.isAdmin) {
    throw new PaymentError("Forbidden", "admin access required");
  }
  return actor.userId;
}

export async function listRefundRequests(
  deps: RefundDeps,
  actor: PaymentActor,
  input: { onlyOpen?: boolean } = {},
): Promise<AdminRefundRow[]> {
  requireAdmin(actor);
  return deps.store.listAdminRefunds({ onlyOpen: input.onlyOpen ?? true });
}

export interface ResolveRefundInput {
  refundRequestId: string;
  action: "approve" | "reject";
  note?: string;
}

export interface ResolveRefundResult {
  refundRequestId: string;
  status: "rejected" | "completed";
  refundTxHash: string | null;
}

const REFUND_CONFIRM_ATTEMPTS = 8;
const REFUND_CONFIRM_DELAY_MS = 1500;
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const OPEN_STATUSES = new Set([
  "submitted",
  "under_review",
  "seller_response_needed",
]);

/**
 * RESOLVE REFUND — admin only.
 *
 * reject: refund_requests → rejected (decision release_seller). The escrow
 * stays funded; the buyer's normal confirm-received release is unblocked.
 *
 * approve: mark approved (audit + heal-able state), then the same on-chain
 * discipline as RELEASE-1: fresh chain read must be Funded with matching
 * buyer/amount → operator-signed `refund_to_buyer` → poll until the chain
 * reads Refunded → atomic DB record (RPC). Partial failure leaves 'approved',
 * which a re-call (or the refund-review-sync worker) converges; double refund
 * is impossible (contract InvalidStatus + RPC funded-guard).
 */
export async function resolveRefundRequest(
  deps: RefundDeps,
  actor: PaymentActor,
  input: ResolveRefundInput,
): Promise<ResolveRefundResult> {
  const adminUserId = requireAdmin(actor);

  const ctx = await deps.store.loadRefundResolutionContext(
    input.refundRequestId,
  );
  if (!ctx) {
    throw new PaymentError("OrderNotFound", "refund request not found");
  }
  const note = input.note?.trim() || null;

  if (input.action === "reject") {
    if (!OPEN_STATUSES.has(ctx.refund.status)) {
      throw new PaymentError(
        "Conflict",
        `refund request is not open (status: ${ctx.refund.status})`,
      );
    }
    const { applied } = await deps.store.markRefundRejected({
      refundRequestId: ctx.refund.id,
      adminUserId,
      note,
    });
    if (!applied) {
      throw new PaymentError(
        "Conflict",
        "refund request changed concurrently; reload and retry",
      );
    }
    return {
      refundRequestId: ctx.refund.id,
      status: "rejected",
      refundTxHash: null,
    };
  }

  // --- approve ---------------------------------------------------------------
  // 'approved' is a legal re-entry (heal a prior partial failure).
  if (!OPEN_STATUSES.has(ctx.refund.status) && ctx.refund.status !== "approved") {
    throw new PaymentError(
      "Conflict",
      `refund request is not approvable (status: ${ctx.refund.status})`,
    );
  }
  const escrow = ctx.escrow;
  if (!escrow || !escrow.contractOrderId) {
    throw new PaymentError("Conflict", "escrow linkage is missing");
  }
  if (escrow.status !== "funded" && escrow.status !== "refunded") {
    throw new PaymentError(
      "Conflict",
      `escrow is not refundable (status: ${escrow.status})`,
    );
  }

  // --- Fresh on-chain truth ----------------------------------------------------
  const onchain = await deps.gateway.readOrder(escrow.contractOrderId);
  if (!onchain) {
    throw new PaymentError("RpcFailure", "could not read the on-chain order");
  }
  if (escrow.buyerPublicKey && onchain.buyer !== escrow.buyerPublicKey) {
    throw new PaymentError(
      "ChainOrderMismatch",
      "on-chain order buyer does not match the recorded funding wallet",
    );
  }
  if (onchain.amount !== usdcToUnits(escrow.amountUsdc)) {
    throw new PaymentError(
      "AmountMismatch",
      "on-chain order amount does not match the escrow record",
    );
  }
  if (onchain.status !== "Funded" && onchain.status !== "Refunded") {
    throw new PaymentError(
      "Conflict",
      `on-chain escrow is not refundable (status: ${onchain.status})`,
    );
  }

  // --- Record the decision BEFORE moving money (heal-able audit state) ---------
  if (ctx.refund.status !== "approved") {
    const { applied } = await deps.store.markRefundApproved({
      refundRequestId: ctx.refund.id,
      adminUserId,
      note,
    });
    if (!applied) {
      throw new PaymentError(
        "Conflict",
        "refund request changed concurrently; reload and retry",
      );
    }
  }

  // --- Refund (or heal an already-Refunded chain) --------------------------------
  let refundTxHash: string;
  let ledger: number | null = null;

  if (onchain.status === "Refunded") {
    const known =
      escrow.refundTxHash ?? (await deps.store.findRefundTxHash(ctx.orderId));
    if (!known) {
      throw new PaymentError(
        "Conflict",
        "escrow is refunded on-chain but the refund transaction is unknown; requires operator reconciliation",
      );
    }
    refundTxHash = known;
  } else {
    let refundRes;
    try {
      refundRes = await deps.gateway.refundOrder({
        contractOrderIdHex: escrow.contractOrderId,
      });
    } catch (e) {
      if (e instanceof OperatorSignerError) {
        throw new PaymentError(e.code, e.message);
      }
      throw new PaymentError(
        "RpcFailure",
        "could not submit the refund transaction; please retry",
        e,
      );
    }
    if (refundRes.status === "ERROR") {
      throw new PaymentError(
        "SubmitRejected",
        "the network rejected the refund transaction; please retry",
      );
    }
    if (refundRes.status === "TRY_AGAIN_LATER") {
      throw new PaymentError(
        "RpcFailure",
        "the network is busy; please retry the refund",
      );
    }
    refundTxHash = refundRes.hash;
    // Persist the submitted hash BEFORE confirmation so a crash is healable.
    await deps.store.recordRefundSubmitted({
      orderId: ctx.orderId,
      escrowId: escrow.id,
      txHash: refundTxHash,
      sourceAccount: refundRes.sourceAccount,
      amountUsdc: escrow.amountUsdc,
      network: deps.config.networkName,
    });

    let landed = false;
    for (let i = 0; i < REFUND_CONFIRM_ATTEMPTS; i++) {
      const res = await deps.gateway.getTransactionResult(refundTxHash);
      if (res.status === "SUCCESS") {
        ledger = res.ledger ?? null;
        landed = true;
        break;
      }
      if (res.status === "FAILED") {
        throw new PaymentError(
          "SubmitRejected",
          "the refund transaction failed on-chain; please retry",
        );
      }
      if (i < REFUND_CONFIRM_ATTEMPTS - 1) await sleep(REFUND_CONFIRM_DELAY_MS);
    }
    if (!landed) {
      throw new PaymentError(
        "RpcFailure",
        "refund submitted but not yet confirmed; please retry to finalize",
      );
    }
    const after = await deps.gateway.readOrder(escrow.contractOrderId);
    if (!after || after.status !== "Refunded") {
      throw new PaymentError(
        "Conflict",
        "refund transaction landed but the on-chain order is not Refunded",
      );
    }
  }

  // --- Atomic DB record ----------------------------------------------------------
  await deps.store.confirmRefunded({
    orderId: ctx.orderId,
    escrowId: escrow.id,
    refundRequestId: ctx.refund.id,
    txHash: refundTxHash,
    ledger,
    toPublicKey: escrow.buyerPublicKey,
    amountUsdc: escrow.amountUsdc,
    network: deps.config.networkName,
  });

  return {
    refundRequestId: ctx.refund.id,
    status: "completed",
    refundTxHash,
  };
}
