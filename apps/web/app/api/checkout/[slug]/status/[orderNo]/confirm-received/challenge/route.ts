// Buyer confirm-received challenge (RELEASE-1). Public route: possession of
// (slug, order_no) lets a caller REQUEST a challenge, but only a signature
// from the escrow's funding wallet can ever confirm/release — the seller
// knowing this URL gains nothing. One generic 404 for missing AND ineligible
// orders (no oracle). Rate-limited tightly (order_no probe surface).
import { issueConfirmReceivedChallenge, PaymentError } from "@trustip/payments";
import {
  checkoutSlugSchema,
  confirmReceivedChallengeSchema,
  orderNoSchema,
} from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceConfirmReceivedRateLimit,
  errorResponse,
  parseJsonBody,
} from "../../../../../../_lib/payments";
import { getReleaseDeps } from "../../../../../../_lib/release";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; orderNo: string }> },
): Promise<NextResponse> {
  const limited = enforceConfirmReceivedRateLimit(request);
  if (limited) return limited;
  try {
    const raw = await context.params;
    const slug = checkoutSlugSchema.safeParse(raw.slug);
    const orderNo = orderNoSchema.safeParse(raw.orderNo);
    if (!slug.success || !orderNo.success) {
      throw new PaymentError("CheckoutNotFound", "order not found");
    }
    const body = await parseJsonBody(request, confirmReceivedChallengeSchema);
    const result = await issueConfirmReceivedChallenge(getReleaseDeps(), {
      slug: slug.data,
      orderNo: orderNo.data,
      networkPassphrase: body.networkPassphrase,
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
