// Buyer refund request (REFUND-1). Authorized by possession of the public
// (slug, order_no) pair — same discipline as status reads. Never moves money:
// it only freezes release until an admin resolves it, and an on-chain refund
// can go nowhere except the funding buyer wallet. One generic 404 for missing
// AND ineligible orders (no oracle).
import { createRefundRequest, PaymentError } from "@trustip/payments";
import {
  checkoutSlugSchema,
  createRefundRequestSchema,
  orderNoSchema,
} from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceRateLimit,
  errorResponse,
  parseJsonBody,
} from "../../../../../_lib/payments";
import { getRefundDeps } from "../../../../../_lib/refund";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; orderNo: string }> },
): Promise<NextResponse> {
  const limited = enforceRateLimit(request, "refund-request");
  if (limited) return limited;
  try {
    const raw = await context.params;
    const slug = checkoutSlugSchema.safeParse(raw.slug);
    const orderNo = orderNoSchema.safeParse(raw.orderNo);
    if (!slug.success || !orderNo.success) {
      throw new PaymentError("CheckoutNotFound", "order not found");
    }
    const body = await parseJsonBody(request, createRefundRequestSchema);
    const result = await createRefundRequest(getRefundDeps(), {
      slug: slug.data,
      orderNo: orderNo.data,
      reasonCode: body.reasonCode,
      description: body.description,
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
