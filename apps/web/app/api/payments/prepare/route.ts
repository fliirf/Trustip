import { preparePayment } from "@trustip/payments";
import { preparePaymentSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceRateLimit,
  errorResponse,
  getPaymentDeps,
  parseJsonBody,
} from "../../_lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/prepare
 * Validate a payable order and return the buyer's unsigned `fund_order` XDR.
 * Never marks paid, never submits. Amount is derived server-side from the order.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const limited = enforceRateLimit(request, "prepare");
    if (limited) return limited;
    const input = await parseJsonBody(request, preparePaymentSchema);
    const result = await preparePayment(getPaymentDeps(), input);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
