import { submitPayment } from "@trustip/payments";
import { submitPaymentSchema } from "@trustip/validators";
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
 * POST /api/payments/submit
 * Accept a wallet-signed XDR and forward it to the network. Sets status to
 * `submitted` only — escrow is not marked funded until SYNC verifies on-chain.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const limited = enforceRateLimit(request, "submit");
    if (limited) return limited;
    const input = await parseJsonBody(request, submitPaymentSchema);
    const result = await submitPayment(getPaymentDeps(), input);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
