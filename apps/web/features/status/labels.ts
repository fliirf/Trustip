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
 * preconditions exactly so the button never appears when a confirm would be
 * rejected: shipped, shipment shipped, escrow funded, payment confirmed, and
 * not already released. */
export function canConfirmReceived(order: PublicOrderStatus): boolean {
  return (
    order.status === "shipped" &&
    order.shipment?.status === "shipped" &&
    order.escrow?.status === "funded" &&
    order.payment?.status === "confirmed" &&
    !isReleased(order)
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
