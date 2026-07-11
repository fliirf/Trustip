// Lifecycle derivation shared by every surface that renders escrow state —
// buyer status page and seller dashboard. ONE derivation, so the seller can
// never see progress the buyer's page would not show, and neither can run
// ahead of the backend.
//
// Every function here is pure and reads ONLY backend-recorded fields. Nothing
// is inferred from elapsed time, from the viewer's identity, or from an
// in-flight mutation. Future steps are always "locked", never "done".

import type { EscrowCoreState } from "./EscrowCore";

/** The structural subset of an order these derivations need. Both
 * `PublicOrderStatus` (buyer) and `SellerOrder` (seller) satisfy it, so the two
 * surfaces share one source of truth instead of two drifting copies. */
export interface LifecycleOrder {
  status: string;
  payment: { status: string } | null;
  escrow: { status: string } | null;
  shipment: { status: string } | null;
}

export type RailStepState = "done" | "current" | "locked";

export interface RailStep {
  key: string;
  label: string;
  state: RailStepState;
}

const PROCESSING_DONE = [
  "processing",
  "packed",
  "shipped",
  "delivered",
  "completed",
];
const SHIPPING_DONE = ["shipped", "delivered", "completed"];
const POST_PROTECTION = [
  "escrow_locked",
  ...PROCESSING_DONE,
  "payout_pending",
  "payout_completed",
];

/** True when the buyer's money is actually protected on-chain. */
export function isProtected(order: LifecycleOrder): boolean {
  return order.escrow?.status === "funded" || order.status === "escrow_locked";
}

export function isTerminalBad(order: LifecycleOrder): boolean {
  return ["refunded", "cancelled", "failed"].includes(order.status);
}

/** True once the buyer-confirmed release has actually landed on-chain — the
 * only state where the funds have moved to the seller. Backend truth only. */
export function isReleased(order: LifecycleOrder): boolean {
  return order.escrow?.status === "released" || order.status === "completed";
}

/** Fulfillment progress index from backend truth (order status OR the real
 * shipment record — whichever is further, both are backend-recorded). */
export function shipmentProgress(order: LifecycleOrder): number {
  const rank = (s: string | undefined | null): number =>
    s ? ["processing", "packed", "shipped"].indexOf(s) + 1 : 0;
  return Math.max(
    rank(order.shipment?.status),
    SHIPPING_DONE.includes(order.status)
      ? 3
      : order.status === "packed"
        ? 2
        : order.status === "processing"
          ? 1
          : 0,
  );
}

/** Visual state of the escrow artifact, derived STRICTLY from backend records.
 *
 * Ordering matters: a terminal-bad order never renders as held or settled, and
 * `completed` outranks `funded` so a released escrow can never show a heartbeat.
 * The `shipped` state requires the backend to have actually recorded shipment —
 * it is never inferred from elapsed time or from the viewer's presence. */
export function escrowCoreState(order: LifecycleOrder): EscrowCoreState {
  if (isTerminalBad(order)) return "voided";
  if (isReleased(order)) return "completed";
  if (isProtected(order)) {
    return shipmentProgress(order) >= 3 ? "shipped" : "funded";
  }
  return "dormant";
}

/** Protected + paid but the seller has not shipped yet — buyer waits. */
export function awaitingShipment(order: LifecycleOrder): boolean {
  return (
    isProtected(order) &&
    !isReleased(order) &&
    order.shipment?.status !== "shipped" &&
    order.status !== "shipped"
  );
}

/** Derive the lifecycle rail from BACKEND state only. Future steps are
 * "locked" (never shown as progress the backend has not recorded). The
 * "Diterima" / "Selesai" completion steps only appear once the backend has
 * actually recorded delivery/release — never inferred ahead of it.
 *
 * `withPacked` inserts the seller's own "Dikemas" step. The buyer's rail omits
 * it (packing is an internal fulfillment detail shown to them elsewhere), so
 * the two rails stay purpose-built without forking the derivation. */
export function lifecycleRail(
  order: LifecycleOrder,
  withPacked = false,
): RailStep[] {
  const paid =
    order.payment?.status === "confirmed" ||
    POST_PROTECTION.includes(order.status);
  const protectedNow =
    isProtected(order) || POST_PROTECTION.includes(order.status);
  const progress = shipmentProgress(order);
  const processing = progress >= 1;
  const packed = progress >= 2;
  const shipped = progress >= 3;
  const released = isReleased(order);
  // Backend truth: the buyer-confirmed release (or an explicit delivered
  // state) is the only signal that the order was received.
  const delivered =
    released ||
    order.status === "delivered" ||
    order.shipment?.status === "delivered";

  const step = (
    key: string,
    label: string,
    done: boolean,
    prevDone: boolean,
  ): RailStep => ({
    key,
    label,
    state: done ? "done" : prevDone ? "current" : "locked",
  });

  const rail: RailStep[] = [
    { key: "created", label: "Pesanan Dibuat", state: "done" },
    step("paid", "Pembayaran", paid, true),
    step("protected", "Dana Dilindungi", protectedNow, paid),
    step("processing", "Diproses Seller", processing, protectedNow),
  ];

  if (withPacked) rail.push(step("packed", "Dikemas", packed, processing));

  rail.push(step("shipped", "Dikirim", shipped, withPacked ? packed : processing));

  // Only extend to the completion steps once the backend confirms delivery/
  // release. Non-completed orders keep the exact rail they had before.
  if (delivered) {
    rail.push(
      step("received", "Diterima", delivered, shipped),
      step("completed", "Selesai", released, delivered),
    );
  }

  return rail;
}
