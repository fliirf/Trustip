// Buyer review of a completed order (Trust Profile & Reviews). Authorized by
// possession of the public (slug, order_no) pair — same discipline as status
// reads and refund requests. Never moves money: it records a rating and
// recomputes the seller's derived trust profile. One review per order (409
// AlreadyReviewed on the second). One generic 404 for missing AND ineligible
// orders (no oracle).
import { PaymentError, submitReview } from "@trustip/payments";
import {
  checkoutSlugSchema,
  orderNoSchema,
  submitReviewSchema,
} from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceRateLimit,
  errorResponse,
  parseJsonBody,
} from "../../../../../_lib/payments";
import { getReviewDeps } from "../../../../../_lib/reviews";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; orderNo: string }> },
): Promise<NextResponse> {
  const limited = enforceRateLimit(request, "submit-review");
  if (limited) return limited;
  try {
    const raw = await context.params;
    const slug = checkoutSlugSchema.safeParse(raw.slug);
    const orderNo = orderNoSchema.safeParse(raw.orderNo);
    if (!slug.success || !orderNo.success) {
      throw new PaymentError("CheckoutNotFound", "order not found");
    }
    const body = await parseJsonBody(request, submitReviewSchema);
    const result = await submitReview(getReviewDeps(), {
      slug: slug.data,
      orderNo: orderNo.data,
      rating: body.rating,
      comment: body.comment,
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
