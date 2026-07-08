// Buyer confirm-received + guarded escrow release (RELEASE-1). The ONLY path
// that releases escrowed funds. Requires a signature from the exact funding
// wallet (slug+order_no possession alone — which the seller also has — is
// NEVER sufficient). All money truth is verified on-chain before and after
// the operator-signed release; the DB is only marked released/completed once
// the chain reads Released (atomic RPC). Returns safe public fields only.
import {
  confirmOrderReceivedAndRelease,
  PaymentError,
} from "@trustip/payments";
import {
  checkoutSlugSchema,
  confirmReceivedSchema,
  orderNoSchema,
} from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceConfirmReceivedRateLimit,
  errorResponse,
  parseJsonBody,
} from "../../../../../_lib/payments";
import { getReleaseDeps } from "../../../../../_lib/release";

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
    const body = await parseJsonBody(request, confirmReceivedSchema);
    const result = await confirmOrderReceivedAndRelease(getReleaseDeps(), {
      slug: slug.data,
      orderNo: orderNo.data,
      signedChallengeXdr: body.signedChallengeXdr,
      challengeToken: body.challengeToken,
      networkPassphrase: body.networkPassphrase,
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
