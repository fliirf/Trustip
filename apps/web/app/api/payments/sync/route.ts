import { syncPayment } from "@trustip/payments";
import { syncPaymentSchema } from "@trustip/validators";
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
 * POST /api/payments/sync
 * Verify the submitted tx's on-chain result and update the DB truthfully.
 * Idempotent; only a chain-confirmed `Funded` order marks the payment confirmed.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const limited = enforceRateLimit(request, "sync");
    if (limited) return limited;
    const input = await parseJsonBody(request, syncPaymentSchema);
    const result = await syncPayment(getPaymentDeps(), input);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
