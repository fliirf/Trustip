// Seller payout methods (phase 10 — payout foundation). GET lists the seller's
// methods; POST adds one. Bearer auth (getActor → seller profile). Config only:
// no escrow/release/money movement. USDC/XLM routes must reference a wallet the
// seller has already verified; MoneyGram is a guided route (needs_review).
import { addPayoutMethod, listPayoutMethods } from "@trustip/payments";
import { addPayoutMethodSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceSellerRateLimit,
  errorResponse,
  getActor,
  parseJsonBody,
} from "../../_lib/payments";
import { getPayoutDeps } from "../../_lib/payout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const limited = enforceSellerRateLimit(request);
  if (limited) return limited;
  try {
    const actor = await getActor(request);
    const methods = await listPayoutMethods(getPayoutDeps(), actor);
    return NextResponse.json({ methods });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const limited = enforceSellerRateLimit(request);
  if (limited) return limited;
  try {
    const body = await parseJsonBody(request, addPayoutMethodSchema);
    const actor = await getActor(request);
    const method = await addPayoutMethod(getPayoutDeps(), actor, body);
    return NextResponse.json(method, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
