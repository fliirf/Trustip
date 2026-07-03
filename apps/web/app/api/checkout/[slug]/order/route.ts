import { createOrderFromCheckout } from "@trustip/payments";
import { checkoutSlugSchema, createOrderSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceOrderCreateRateLimit,
  errorResponse,
  getPaymentDeps,
  parseJsonBody,
} from "../../../_lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The shared createOrderSchema carries checkoutLinkId, but this route resolves
// the link by its PUBLIC slug (path param) — a link UUID is never accepted.
const bodySchema = createOrderSchema.omit({ checkoutLinkId: true });

/**
 * POST /api/checkout/[slug]/order
 * Create an `awaiting_payment` order from an ACTIVE, unexpired checkout link.
 * Price/seller/total are server-derived from the link; the client sends only
 * quantity + buyer contact/shipping. Returns {orderId, orderNo} so the buyer
 * checkout flow can continue to token → create-order → prepare. Never marks
 * paid, never touches payment/escrow state.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  try {
    const limited = enforceOrderCreateRateLimit(request);
    if (limited) return limited;
    const { slug } = await params;
    const parsedSlug = checkoutSlugSchema.safeParse(slug);
    if (!parsedSlug.success) {
      return NextResponse.json(
        { error: { code: "InvalidInput", message: "invalid checkout slug" } },
        { status: 400 },
      );
    }
    const input = await parseJsonBody(request, bodySchema);
    const result = await createOrderFromCheckout(getPaymentDeps(), {
      slug: parsedSlug.data,
      ...input,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
