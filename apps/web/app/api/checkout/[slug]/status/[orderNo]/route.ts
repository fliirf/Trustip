// PUBLIC read-only order status (STATUS-1A). Lookup is authorized purely by
// possession of the high-entropy order_no scoped to its checkout slug — the
// same discipline as checkout-token issuance. No listing, no mutation, one
// generic 404 for every miss. Rate-limited like the other status reads.
import { getPublicOrderStatus, PaymentError } from "@trustip/payments";
import { checkoutSlugSchema, orderNoSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceStatusRateLimit,
  errorResponse,
} from "../../../../_lib/payments";
import { getSellerDeps } from "../../../../_lib/seller";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string; orderNo: string }> },
): Promise<NextResponse> {
  const limited = enforceStatusRateLimit(request);
  if (limited) return limited;
  try {
    const raw = await context.params;
    const slug = checkoutSlugSchema.safeParse(raw.slug);
    const orderNo = orderNoSchema.safeParse(raw.orderNo);
    if (!slug.success || !orderNo.success) {
      throw new PaymentError("CheckoutNotFound", "order not found");
    }
    const status = await getPublicOrderStatus(getSellerDeps(), {
      slug: slug.data,
      orderNo: orderNo.data,
    });
    return NextResponse.json(status);
  } catch (e) {
    return errorResponse(e);
  }
}
