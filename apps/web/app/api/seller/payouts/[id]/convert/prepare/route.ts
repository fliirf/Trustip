// Prepare a seller USDC->XLM conversion (XLM_WALLET route execution). Builds an
// UNSIGNED strict-send path payment the seller signs in their own wallet + a
// short-lived binding token. The operator signs nothing. Bearer auth.
import { PaymentError, prepareXlmConversion } from "@trustip/payments";
import { payoutMethodIdSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceSellerRateLimit,
  errorResponse,
  getActor,
} from "../../../../../_lib/payments";
import { getConversionDeps } from "../../../../../_lib/payout";

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
      throw new PaymentError("OrderNotFound", "payout not found");
    }
    const actor = await getActor(request);
    const result = await prepareXlmConversion(getConversionDeps(), actor, id.data);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
