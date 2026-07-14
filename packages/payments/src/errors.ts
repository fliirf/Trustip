/** Typed payment-service error model. Each code carries an HTTP status so thin
 * route handlers can translate a thrown error into a response without knowing
 * the internals. Messages are safe to return to the client (no secrets). */
export type PaymentErrorCode =
  | "InvalidInput"
  | "WrongNetwork"
  | "OrderNotFound"
  | "PaymentNotFound"
  | "OrderNotPayable"
  | "WrongBuyer"
  | "AmountMismatch"
  | "EscrowNotReady"
  | "EscrowAlreadyFunded"
  | "InvalidSignedTx"
  | "DuplicateTx"
  | "SubmitRejected"
  | "Forbidden"
  | "RateLimited"
  | "RpcFailure"
  | "Conflict"
  // --- Escrow create_order orchestration (Phase 4.1) ---
  | "InvalidBuyerPublicKey"
  | "OrderNotEligible"
  | "AdminSignerMissing"
  | "AdminSignerNotAllowedOnMainnet"
  | "EscrowAlreadyCreated"
  | "EscrowCreateFailed"
  | "ChainOrderMismatch"
  | "ContractOrderAlreadyExists"
  // --- Checkout token issuance (Phase 5.0) ---
  | "CheckoutNotFound"
  | "CheckoutNotAvailable"
  | "CheckoutTokenUnavailable"
  // --- Seller onboarding (Phase 7B) ---
  | "WalletNotFound"
  | "WalletChallengeUnavailable"
  // --- Seller checkout links (Phase 7C) ---
  | "SellerNotReady"
  // --- Reviews / Trust Profile ---
  | "AlreadyReviewed"
  // --- Seller payout wallet readiness (PAYOUT-GUARD-1) ---
  | "SellerPayoutWalletNotReady"
  // --- Dependency / unexpected failures (Phase 10B) ---
  | "ServiceUnavailable"
  | "InternalError";

const HTTP_STATUS: Record<PaymentErrorCode, number> = {
  InvalidInput: 400,
  WrongNetwork: 400,
  OrderNotFound: 404,
  PaymentNotFound: 404,
  OrderNotPayable: 409,
  WrongBuyer: 403,
  AmountMismatch: 409,
  EscrowNotReady: 409,
  EscrowAlreadyFunded: 409,
  InvalidSignedTx: 400,
  DuplicateTx: 409,
  SubmitRejected: 502,
  Forbidden: 403,
  RateLimited: 429,
  RpcFailure: 502,
  Conflict: 409,
  // create_order orchestration
  InvalidBuyerPublicKey: 400,
  OrderNotEligible: 409,
  AdminSignerMissing: 503,
  AdminSignerNotAllowedOnMainnet: 503,
  EscrowAlreadyCreated: 409,
  EscrowCreateFailed: 502,
  ChainOrderMismatch: 409,
  ContractOrderAlreadyExists: 409,
  // checkout token issuance
  CheckoutNotFound: 404,
  CheckoutNotAvailable: 409,
  CheckoutTokenUnavailable: 503,
  // seller onboarding
  WalletNotFound: 404,
  WalletChallengeUnavailable: 503,
  // seller checkout links
  SellerNotReady: 409,
  // reviews / trust profile
  AlreadyReviewed: 409,
  // seller payout wallet readiness
  SellerPayoutWalletNotReady: 409,
  // dependency / unexpected failures
  ServiceUnavailable: 503,
  InternalError: 500,
};

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  readonly httpStatus: number;
  readonly cause?: unknown;

  constructor(code: PaymentErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
    this.cause = cause;
  }
}

/** Narrow an unknown thrown value to a PaymentError, wrapping anything else as
 * an opaque RpcFailure (never leaks internal error text as a typed code). */
export function toPaymentError(raw: unknown): PaymentError {
  if (raw instanceof PaymentError) return raw;
  const message = raw instanceof Error ? raw.message : String(raw);
  return new PaymentError("RpcFailure", message, raw);
}

/** A PostgREST/Supabase error: a plain object with a message, never an Error
 * instance. That distinction is what lets `errorResponse` tell a store failure
 * apart from an ordinary bug in our own code. */
export interface StoreError {
  message?: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

export function isStoreError(raw: unknown): raw is StoreError {
  return (
    typeof raw === "object" &&
    raw !== null &&
    !(raw instanceof Error) &&
    typeof (raw as { message?: unknown }).message === "string"
  );
}

/**
 * Classify a Supabase/PostgREST error into a typed PaymentError.
 *
 * A SQLSTATE/PGRST `code` means the database ANSWERED and rejected the query —
 * our bug, and retrying will not help: InternalError (500). No `code` means the
 * request never reached the database (transport failure, or a 5xx from the API
 * gateway) — the dependency is down and a retry may well succeed:
 * ServiceUnavailable (503).
 *
 * Verified against supabase-js 2.108: a stopped PostgREST container surfaces as
 * `{ message: "An invalid response was received from the upstream server" }`
 * with no `code`, while a bad query surfaces as `{ code: "42703", ... }`.
 *
 * The raw error is kept as `cause` for server logs and is never serialized to
 * the client — messages here are deliberately generic.
 */
export function toStoreError(raw: unknown): PaymentError {
  if (raw instanceof PaymentError) return raw;
  const code = isStoreError(raw) ? raw.code : undefined;
  return code
    ? new PaymentError("InternalError", "internal server error", raw)
    : new PaymentError(
        "ServiceUnavailable",
        "service temporarily unavailable, please retry",
        raw,
      );
}

/**
 * Unwrap a Supabase result, turning a dropped `error` into a typed failure.
 *
 * Destructuring only `data` makes an outage indistinguishable from an empty
 * table: the read yields null, the caller reports "not found", and a buyer who
 * has already paid is told their order does not exist. Every read goes through
 * here so that can never happen again.
 */
export function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw toStoreError(result.error);
  return result.data;
}
