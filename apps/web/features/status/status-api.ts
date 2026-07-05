// Typed fetch wrapper for the PUBLIC order-status endpoint. Client-safe: local
// response types only. Read-only by construction — there is nothing here that
// can mutate order/payment/escrow state.

export class StatusApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "StatusApiError";
    this.code = code;
    this.status = status;
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
  link: { title: string; description: string | null; slug: string };
  storeName: string | null;
  buyer: OrderStatusBuyer | null;
  payment: { status: string; txHash: string | null } | null;
  escrow: { status: string; fundedTxHash: string | null } | null;
  shipment: null;
}

export async function fetchOrderStatus(
  slug: string,
  orderNo: string,
): Promise<PublicOrderStatus> {
  const res = await fetch(
    `/api/checkout/${encodeURIComponent(slug)}/status/${encodeURIComponent(orderNo)}`,
  );
  if (!res.ok) {
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
    throw new StatusApiError(code, message, res.status);
  }
  return (await res.json()) as PublicOrderStatus;
}
