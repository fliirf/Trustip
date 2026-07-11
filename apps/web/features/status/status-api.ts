// Typed fetch wrappers for the PUBLIC order-status endpoints. Client-safe:
// local response types only, never imports @trustip/payments. Reads are
// read-only by construction. The confirm-received calls are the ONE mutation
// reachable here, and they release NOTHING without a buyer wallet signature
// (the backend derives the funding wallet and verifies the signature).

export class StatusApiError extends Error {
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
    this.name = "StatusApiError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface OrderStatusBuyer {
  name: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface PublicOrderStatus {
  orderNo: string;
  status: string;
  totalUsdc: string;
  quantity: number | null;
  createdAt: string;
  /** Set only once the order has actually completed (buyer-confirmed release);
   * null otherwise — never inferred ahead of backend truth. */
  completedAt: string | null;
  link: { title: string; description: string | null; slug: string };
  storeName: string | null;
  buyer: OrderStatusBuyer | null;
  payment: { status: string; txHash: string | null } | null;
  /** `releaseTxHash` is null until the escrow is released on-chain (buyer
   * confirmed receipt) — never rendered as proof before then. */
  escrow: {
    status: string;
    fundedTxHash: string | null;
    releaseTxHash: string | null;
  } | null;
  /** Real shipment progress recorded by the seller (Phase 8A) — null until
   * fulfillment starts. Read-only; never implies delivery or release. */
  shipment: {
    status: string;
    courier: string | null;
    trackingNumber: string | null;
    shippedAt: string | null;
  } | null;
}

/** Server-signed challenge the buyer's funding wallet must sign to confirm
 * receipt. `buyerPublicKey` is the funding wallet (public on-chain info) — the
 * UI never lets the buyer choose it. */
export interface ConfirmReceivedChallenge {
  challengeXdr: string;
  challengeToken: string;
  expiresAt: string;
  buyerPublicKey: string;
  networkPassphrase: string;
}

/** Result of a successful confirm — the ONLY moment a release tx hash exists. */
export interface ConfirmReceivedResult {
  orderNo: string;
  orderStatus: "completed";
  escrowStatus: "released";
  releaseTxHash: string;
}

async function parseError(res: Response): Promise<StatusApiError> {
  let code = "InternalError";
  let message = "terjadi kesalahan";
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string };
    };
    code = body.error?.code ?? code;
    message = body.error?.message ?? message;
  } catch {
    // non-JSON body — keep defaults
  }
  const retryRaw = res.headers.get("retry-after");
  const retry = retryRaw ? Number(retryRaw) : null;
  return new StatusApiError(
    code,
    message,
    res.status,
    Number.isFinite(retry) ? retry : null,
  );
}

export async function fetchOrderStatus(
  slug: string,
  orderNo: string,
): Promise<PublicOrderStatus> {
  const res = await fetch(
    `/api/checkout/${encodeURIComponent(slug)}/status/${encodeURIComponent(orderNo)}`,
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as PublicOrderStatus;
}

function confirmBase(slug: string, orderNo: string): string {
  return `/api/checkout/${encodeURIComponent(slug)}/status/${encodeURIComponent(orderNo)}/confirm-received`;
}

/** Request the confirm-received challenge. Possession of (slug, orderNo) only
 * lets a caller REQUEST it — signing is what proves the buyer. */
export async function requestConfirmReceivedChallenge(
  slug: string,
  orderNo: string,
  networkPassphrase: string,
): Promise<ConfirmReceivedChallenge> {
  const res = await fetch(`${confirmBase(slug, orderNo)}/challenge`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ networkPassphrase }),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as ConfirmReceivedChallenge;
}

/** Submit the signed challenge. The backend runs every release guard and only
 * releases when the signature is from the exact funding wallet. */
export async function confirmReceived(
  slug: string,
  orderNo: string,
  input: {
    signedChallengeXdr: string;
    challengeToken: string;
    networkPassphrase: string;
  },
): Promise<ConfirmReceivedResult> {
  const res = await fetch(confirmBase(slug, orderNo), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as ConfirmReceivedResult;
}
