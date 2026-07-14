// Seller payout history (phase 10 — payout_requests flow). Read-only. A direct
// USDC payout is the escrow release itself, auto-recorded at release. Bearer
// auth; the service scopes to the seller's own payouts.
import { listPayouts } from "@trustip/payments";
import { NextResponse } from "next/server";
import {
  enforceSellerRateLimit,
  errorResponse,
  getActor,
} from "../../_lib/payments";
import { getPayoutDeps } from "../../_lib/payout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const limited = enforceSellerRateLimit(request);
  if (limited) return limited;
  try {
    const actor = await getActor(request);
    const payouts = await listPayouts(getPayoutDeps(), actor);
    return NextResponse.json({ payouts });
  } catch (e) {
    return errorResponse(e);
  }
}
