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
  | "WalletChallengeUnavailable";

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
