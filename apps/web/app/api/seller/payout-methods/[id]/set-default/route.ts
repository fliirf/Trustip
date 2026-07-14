// Set a seller payout method as the default route. Bearer auth; the service
// scopes to the seller's own methods and rejects a disabled method. Enforces
// one default per seller (partial unique index).
import { PaymentError, setDefaultPayoutMethod } from "@trustip/payments";
import { payoutMethodIdSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceSellerRateLimit,
  errorResponse,
  getActor,
} from "../../../../_lib/payments";
import { getPayoutDeps } from "../../../../_lib/payout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const limited = enforceSellerRateLimit(request);
  if (limited) return limited;
  try {
    const raw = await context.params;
    const id = payoutMethodIdSchema.safeParse(raw.id);
    if (!id.success) {
      throw new PaymentError("OrderNotFound", "payout method not found");
    }
    const actor = await getActor(request);
    const result = await setDefaultPayoutMethod(getPayoutDeps(), actor, id.data);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
