// Submit a seller-signed USDC->XLM conversion. Verifies the binding token,
// checks the signed tx's source matches the payout wallet, submits it to the
// classic network, and records the conversion. The operator signs nothing.
import { PaymentError, submitXlmConversion } from "@trustip/payments";
import { payoutMethodIdSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  enforceSellerRateLimit,
  errorResponse,
  getActor,
  parseJsonBody,
} from "../../../../_lib/payments";
import { getConversionDeps } from "../../../../_lib/payout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  signedXdr: z.string().min(1).max(65536),
  convertToken: z.string().min(1).max(512),
  sourcePublicKey: z.string().regex(/^G[A-Z2-7]{55}$/),
  sendUsdc: z.string().min(1).max(40),
  estimatedXlm: z.string().min(1).max(40),
});

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
    const body = await parseJsonBody(request, bodySchema);
    const actor = await getActor(request);
    const result = await submitXlmConversion(getConversionDeps(), actor, {
      payoutId: id.data,
      ...body,
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
