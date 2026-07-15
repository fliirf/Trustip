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
  /** False for a no-shipping (digital goods) order — the rail skips the
   * processing/packed/shipped steps entirely. */
  requiresShipping: boolean;
}

export type RailStepState = "done" | "current" | "locked";

export interface RailStep {
  key: string;
  label: string;
  state: RailStepState;
}

/** Labels for each rail step, keyed the same as the `key` values below.
 * Defaults to Indonesian so existing callers (seller dashboard, not yet
 * converted) keep working unchanged; the buyer status page passes its own
 * locale-resolved labels. */
export interface RailLabels {
  created: string;
  paid: string;
  protectedStep: string;
  processing: string;
  packed: string;
  shipped: string;
  received: string;
  completed: string;
}

export const RAIL_LABELS_ID: RailLabels = {
  created: "Pesanan Dibuat",
  paid: "Pembayaran",
  protectedStep: "Dana Dilindungi",
  processing: "Diproses Seller",
  packed: "Dikemas",
  shipped: "Dikirim",
  received: "Diterima",
  completed: "Selesai",
};

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

/** Visual state of the 3D status artifact (StatusCore3D), derived STRICTLY
 * from backend records with the same ordering discipline as escrowCoreState.
 * `refundOpen` is caller-supplied (only the buyer surface knows it) and
 * outranks everything except terminal states: a frozen vault must never
 * render as travelling or settled while review runs. */
export function statusCore3DState(
  order: LifecycleOrder,
  refundOpen = false,
): import("./StatusCore3D").StatusCore3DState {
  if (order.escrow?.status === "refunded") return "returned";
  if (isTerminalBad(order)) return "void";
  if (refundOpen) return "frozen";
  if (isReleased(order)) return "settled";
  if (isProtected(order)) {
    if (order.status === "delivered") return "arriving";
    return shipmentProgress(order) >= 3 ? "shipped" : "protected";
  }
  return "awaiting";
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
  labels: RailLabels = RAIL_LABELS_ID,
): RailStep[] {
  const paid =
    order.payment?.status === "confirmed" ||
    POST_PROTECTION.includes(order.status);
  const protectedNow =
    isProtected(order) || POST_PROTECTION.includes(order.status);
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

  // Digital goods: no processing/packed/shipped concept at all — the seller's
  // one-click "delivered" is the only fulfillment step, so the rail goes
  // straight from "protected" to the completion steps.
  if (!order.requiresShipping) {
    const rail: RailStep[] = [
      { key: "created", label: labels.created, state: "done" },
      step("paid", labels.paid, paid, true),
      step("protected", labels.protectedStep, protectedNow, paid),
    ];
    if (delivered) {
      rail.push(
        step("received", labels.received, delivered, protectedNow),
        step("completed", labels.completed, released, delivered),
      );
    }
    return rail;
  }

  const progress = shipmentProgress(order);
  const processing = progress >= 1;
  const packed = progress >= 2;
  const shipped = progress >= 3;

  const rail: RailStep[] = [
    { key: "created", label: labels.created, state: "done" },
    step("paid", labels.paid, paid, true),
    step("protected", labels.protectedStep, protectedNow, paid),
    step("processing", labels.processing, processing, protectedNow),
  ];

  if (withPacked) rail.push(step("packed", labels.packed, packed, processing));

  rail.push(step("shipped", labels.shipped, shipped, withPacked ? packed : processing));

  // Only extend to the completion steps once the backend confirms delivery/
  // release. Non-completed orders keep the exact rail they had before.
  if (delivered) {
    rail.push(
      step("received", labels.received, delivered, shipped),
      step("completed", labels.completed, released, delivered),
    );
  }

  return rail;
}
