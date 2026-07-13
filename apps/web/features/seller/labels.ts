// Seller-facing copy, locale-aware via the i18n dictionary. Status text always
// reflects BACKEND state.

import type { Dict } from "../../lib/i18n/dictionaries";

/** Stable (non-translated) onboarding step keys — the labels themselves live
 * in `d.seller.onboarding.stepLabels`. */
export const STEP_KEYS = [
  "profile",
  "connect",
  "register",
  "verify",
  "primary",
] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export function stepLabel(d: Dict, key: StepKey): string {
  return d.seller.onboarding.stepLabels[key] ?? key;
}

export function statusLabel(
  map: Record<string, string>,
  status: string | undefined | null,
): string {
  if (!status) return "—";
  return map[status] ?? status;
}

/** Map backend/wallet error codes to seller-friendly copy. */
export function sellerErrorLabel(d: Dict, code: string, fallback: string): string {
  const e = d.seller.errors;
  switch (code) {
    case "Forbidden":
      return e.forbidden;
    case "WrongNetwork":
    case "WalletWrongNetwork":
      return e.wrongNetwork;
    case "UserRejected":
      return e.userRejected;
    case "SigningFailed":
      return e.signingFailed;
    case "MissingWallet":
    case "WalletNotConnected":
      return e.missingWallet;
    case "WalletNotFound":
      return e.walletNotFound;
    case "WalletChallengeUnavailable":
      return e.walletChallengeUnavailable;
    case "SellerNotReady":
      return e.sellerNotReady;
    case "SellerPayoutWalletNotReady":
      return e.sellerPayoutWalletNotReady;
    case "Conflict":
      return fallback.includes("verified") ? e.conflictNotVerified : e.conflictGeneric;
    case "RateLimited":
      return e.rateLimited;
    case "InvalidInput":
      return fallback || e.invalidInputFallback;
    default:
      return fallback || e.generic;
  }
}
