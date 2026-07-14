// One seller payout with its transactions (phase 10 — payout_requests flow).
// Read-only, bearer auth; the service scopes to the seller's own payouts (a
// foreign id resolves to a generic 404).
import { getPayout, PaymentError } from "@trustip/payments";
import { payoutMethodIdSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceSellerRateLimit,
  errorResponse,
  getActor,
} from "../../../_lib/payments";
import { getPayoutDeps } from "../../../_lib/payout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const limited = enforceSellerRateLimit(request);
  if (limited) return limited;
  try {
    const raw = await context.params;
    // payoutMethodIdSchema is a plain uuid schema — reused for any payout uuid.
    const id = payoutMethodIdSchema.safeParse(raw.id);
    if (!id.success) {
      throw new PaymentError("OrderNotFound", "payout not found");
    }
    const actor = await getActor(request);
    const payout = await getPayout(getPayoutDeps(), actor, id.data);
    return NextResponse.json(payout);
  } catch (e) {
    return errorResponse(e);
  }
}
