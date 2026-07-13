// Typed fetch wrappers for the buyer checkout flow. Client-safe: local response
// types only — never imports @trustip/payments (server-only deps). All amounts
// shown to the buyer come from these BACKEND responses; the client computes no
// trusted money value and never marks anything paid.

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export class CheckoutApiError extends Error {
  readonly code: string;
  readonly status: number;
  /** Present on 429 responses (seconds to wait before retrying). */
  readonly retryAfterSeconds: number | null;

  constructor(
    code: string,
    message: string,
    status: number,
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "CheckoutApiError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface CreateOrderResponse {
  orderId: string;
  orderNo: string;
  status: "awaiting_payment";
  totalUsdc: string;
}

export interface CheckoutChallengeResponse {
  challengeXdr: string;
  challengeToken: string;
  expiresAt: string;
  buyerPublicKey: string;
  networkPassphrase: string;
}

export interface CheckoutTokenResponse {
  checkoutToken: string;
  expiresAt: string;
  orderId: string;
  orderNo: string;
  contractOrderId: string;
  networkPassphrase: string;
  amountUsdc: string;
}

export interface CreateEscrowResponse {
  orderId: string;
  escrowId: string;
  contractOrderId: string;
  escrowStatus: string;
  txHash: string | null;
  alreadyExisted: boolean;
}

export interface PrepareResponse {
  paymentId: string;
  unsignedXdr: string;
  networkPassphrase: string;
  contractOrderId: string;
  expectedAmount: string;
  expectedAmountUnits: string;
  attemptToken?: string;
}

export interface SubmitResponse {
  paymentId: string;
  status: "submitted" | "confirmed";
  txHash: string;
  alreadyProcessed: boolean;
}

export interface SyncResponse {
  paymentId: string;
  status: "submitted" | "confirmed" | "failed";
  txHash: string | null;
  pending: boolean;
  applied: boolean;
}

export interface PaymentStatusResponse {
  paymentId: string;
  orderId: string;
  paymentStatus: string;
  orderStatus: string;
  escrowStatus: string | null;
  amountUsdc: string;
  network: string;
  payerPublicKey: string | null;
  txHash: string | null;
  ledger: number | null;
  confirmedAt: string | null;
}

export interface OrderFormFields {
  quantity: number;
  buyerEmail: string;
  buyerName: string;
  /** Omitted for a no-shipping (digital goods) checkout link. */
  shippingAddress?: {
    name: string;
    phone: string;
    addressLine1: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (res.ok) return (await res.json()) as T;

  let code = "InternalError";
  let message = "terjadi kesalahan";
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body?.error?.code) {
      code = body.error.code;
      message = body.error.message;
    }
  } catch {
    // non-JSON error body — keep the generic code
  }
  const retryAfterRaw = res.headers.get("retry-after");
  const retryAfter = retryAfterRaw ? Number(retryAfterRaw) : null;
  throw new CheckoutApiError(
    code,
    message,
    res.status,
    Number.isFinite(retryAfter) ? retryAfter : null,
  );
}

function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: "POST", body: JSON.stringify(body) });
}

export function createOrder(
  slug: string,
  form: OrderFormFields,
): Promise<CreateOrderResponse> {
  return post(`/api/checkout/${encodeURIComponent(slug)}/order`, form);
}

/** SEP-10 step 1 — request a wallet-ownership challenge for the buyer key. */
export function requestCheckoutChallenge(input: {
  slug: string;
  orderNo: string;
  buyerPublicKey: string;
  networkPassphrase: string;
}): Promise<CheckoutChallengeResponse> {
  return post("/api/checkout/token/challenge", input);
}

export function issueCheckoutToken(input: {
  slug: string;
  orderNo: string;
  buyerPublicKey: string;
  networkPassphrase: string;
  signedChallengeXdr: string;
  challengeToken: string;
}): Promise<CheckoutTokenResponse> {
  return post("/api/checkout/token", input);
}

export function createEscrowOrder(input: {
  orderId: string;
  buyerPublicKey: string;
  networkPassphrase: string;
  checkoutToken: string;
}): Promise<CreateEscrowResponse> {
  return post("/api/escrows/create-order", input);
}

export function preparePayment(input: {
  orderId: string;
  buyerPublicKey: string;
  networkPassphrase: string;
}): Promise<PrepareResponse> {
  return post("/api/payments/prepare", input);
}

export function submitPayment(input: {
  paymentId: string;
  signedXdr: string;
  networkPassphrase: string;
  attemptToken?: string;
}): Promise<SubmitResponse> {
  return post("/api/payments/submit", input);
}

export function syncPayment(paymentId: string): Promise<SyncResponse> {
  return post("/api/payments/sync", { paymentId });
}

export function getPaymentStatus(
  paymentId: string,
): Promise<PaymentStatusResponse> {
  return request(`/api/payments/${encodeURIComponent(paymentId)}`);
}
