// Admin refund resolution (REFUND-2): approve → operator-signed on-chain
// refund_to_buyer (chain-verified before AND after, atomic DB record);
// reject → refund closed, buyer release unblocked. Admin role enforced in the
// service, fail closed. The ONLY path that refunds escrowed funds.
import { PaymentError, resolveRefundRequest } from "@trustip/payments";
import {
  refundRequestIdSchema,
  resolveRefundSchema,
} from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceRateLimit,
  errorResponse,
  getActor,
  parseJsonBody,
} from "../../../_lib/payments";
import { getRefundDeps } from "../../../_lib/refund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const limited = enforceRateLimit(request, "admin-refund-resolve");
  if (limited) return limited;
  try {
    const raw = await context.params;
    const id = refundRequestIdSchema.safeParse(raw.id);
    if (!id.success) {
      throw new PaymentError("OrderNotFound", "refund request not found");
    }
    const body = await parseJsonBody(request, resolveRefundSchema);
    const actor = await getActor(request);
    const result = await resolveRefundRequest(getRefundDeps(), actor, {
      refundRequestId: id.data,
      action: body.action,
      note: body.note,
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
