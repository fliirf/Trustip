// Buyer-facing status copy, locale-aware via the i18n dictionary. Lifecycle
// derivation lives in `features/escrow/lifecycle` and is shared with the
// seller dashboard, so both surfaces read the same backend truth. Re-exported
// here so buyer components keep importing lifecycle helpers from one place.

import type { Dict } from "../../lib/i18n/dictionaries";
import { isReleased } from "../escrow/lifecycle";
import type { PublicOrderStatus } from "./status-api";

export {
  awaitingShipment,
  escrowCoreState,
  isProtected,
  isReleased,
  isTerminalBad,
  lifecycleRail,
  shipmentProgress,
} from "../escrow/lifecycle";
export type { RailStep, RailStepState } from "../escrow/lifecycle";

export function statusLabel(
  map: Record<string, string>,
  status: string | undefined | null,
): string {
  if (!status) return "—";
  return map[status] ?? status;
}

/** Eligible to show the "confirm received" CTA. Mirrors the backend release
 * preconditions in `confirmOrderReceivedAndRelease` exactly, so the button
 * never appears when a confirm would be rejected: order shipped OR delivered
 * (the latter covers both a no-shipping digital order and a physical-order
 * retry after a partial release failure) — shipment must itself be "shipped"
 * ONLY when order.status is "shipped" — escrow funded, payment confirmed,
 * and not already released. */
export function canConfirmReceived(order: PublicOrderStatus): boolean {
  const eligibleStatus = order.status === "shipped" || order.status === "delivered";
  const shipmentOk =
    order.status !== "shipped" || order.shipment?.status === "shipped";
  return (
    eligibleStatus &&
    shipmentOk &&
    order.escrow?.status === "funded" &&
    order.payment?.status === "confirmed" &&
    !isReleased(order) &&
    !hasOpenRefund(order)
  );
}

/** Refund states that freeze release — mirrors OPEN_REFUND_STATUSES in the
 * backend release store exactly (rejected/completed are not open). */
const OPEN_REFUND_STATUSES = [
  "submitted",
  "under_review",
  "seller_response_needed",
  "approved",
];

export function hasOpenRefund(order: PublicOrderStatus): boolean {
  return !!order.refund && OPEN_REFUND_STATUSES.includes(order.refund.status);
}

/** Eligible to show the "request refund" affordance. Mirrors the backend
 * eligibility in `createRefundRequest`: money actually escrowed, order not
 * terminal, and no refund already open. A rejected refund may be re-filed. */
export function canRequestRefund(order: PublicOrderStatus): boolean {
  return (
    order.payment?.status === "confirmed" &&
    order.escrow?.status === "funded" &&
    !["completed", "refunded", "cancelled", "failed"].includes(order.status) &&
    !hasOpenRefund(order)
  );
}

/** Map confirm-received backend/wallet error codes to buyer-safe copy. Never
 * hides a safety failure — every rejection stays visible. */
export function confirmErrorLabel(d: Dict, code: string, fallback: string): string {
  return d.status.confirmReceived.error[code] ?? fallback ?? d.status.confirmReceived.error.default;
}

/** Confirm errors where retrying the same step is likely to succeed. */
export function isConfirmRetryable(code: string): boolean {
  return [
    "RpcFailure",
    "SubmitRejected",
    "RateLimited",
    "UserRejected",
    "SigningFailed",
    "Forbidden",
    "InternalError",
  ].includes(code);
}
