// Buyer-facing copy, locale-aware via the i18n dictionary. Status text always
// reflects BACKEND state — the client never invents a success message.

import type { Dict } from "../../lib/i18n/dictionaries";
import type { CheckoutPhase } from "./useCheckoutFlow";

export function phaseLabel(d: Dict, phase: CheckoutPhase): string {
  return d.checkout.phaseLabel[phase] ?? phase;
}

/** Sub-line naming the protocol step actually in flight. Shown under the phase
 * headline while busy, so a slow Stellar confirmation reads as progress instead
 * of a hang. Only phases that wait on something external get one. */
export function phaseDetail(d: Dict, phase: CheckoutPhase): string | undefined {
  return d.checkout.phaseDetail[phase];
}

/** What the buyer should DO about each failure. The `errorLabel` copy says what
 * happened; this says how to recover. Absent = the retry button is the answer. */
export function errorHint(d: Dict, code: string): string | null {
  return d.checkout.errorHint[code] ?? null;
}

/** Step labels for the visible progress timeline. */
export function timelineSteps(d: Dict) {
  return d.checkout.timelineSteps;
}

/** Map backend/wallet error codes to buyer-friendly copy. */
export function errorLabel(d: Dict, code: string, fallback: string): string {
  if (code === "InvalidInput") return fallback || d.checkout.errorLabel.InvalidInput;
  return d.checkout.errorLabel[code] ?? fallback ?? d.checkout.errorLabel.default;
}

/** Errors where a plain retry of the same step is likely to succeed. */
export function isRetryable(code: string): boolean {
  return [
    "RpcFailure",
    "RateLimited",
    "UserRejected",
    "SigningFailed",
    "SubmitRejected",
    "InternalError",
    "ServiceUnavailable",
  ].includes(code);
}
