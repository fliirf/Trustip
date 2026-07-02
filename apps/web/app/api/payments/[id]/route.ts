import { getPaymentStatus } from "@trustip/payments";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  enforceStatusRateLimit,
  errorResponse,
  getActor,
  getPaymentDeps,
} from "../../_lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

/**
 * GET /api/payments/:id
 * Return non-sensitive payment status for UI polling. Fails closed for
 * user-bound orders (buyer/seller/admin only); guest orders are readable by
 * holders of the payment id. No secrets are ever returned.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const limited = enforceStatusRateLimit(request);
    if (limited) return limited;
    const { id } = await params;
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "InvalidInput", message: "invalid payment id" } },
        { status: 400 },
      );
    }
    const actor = await getActor(request);
    const result = await getPaymentStatus(getPaymentDeps(), {
      paymentId: parsed.data,
      actor,
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
