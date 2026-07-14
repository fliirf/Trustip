// Disable a seller payout method (soft: status='disabled'). Bearer auth; the
// service scopes the write to the seller's own methods. Disabled methods can't
// be used for new payout requests (Security spec / API spec §10.1).
import { disablePayoutMethod, PaymentError } from "@trustip/payments";
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

export async function DELETE(
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
    const result = await disablePayoutMethod(getPayoutDeps(), actor, id.data);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
