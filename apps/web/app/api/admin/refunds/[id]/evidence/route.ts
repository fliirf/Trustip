// Admin-only: evidence for one refund request, each with a short-lived signed
// URL (the bucket is private). users.role='admin' enforced in the service.
import { listRefundEvidence, PaymentError } from "@trustip/payments";
import { refundRequestIdSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceRateLimit,
  errorResponse,
  getActor,
} from "../../../../_lib/payments";
import { getRefundDeps } from "../../../../_lib/refund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const limited = enforceRateLimit(request, "admin-refund-evidence");
  if (limited) return limited;
  try {
    const raw = await context.params;
    const id = refundRequestIdSchema.safeParse(raw.id);
    if (!id.success) {
      throw new PaymentError("OrderNotFound", "refund request not found");
    }
    const actor = await getActor(request);
    const evidence = await listRefundEvidence(getRefundDeps(), actor, id.data);
    return NextResponse.json({ evidence });
  } catch (e) {
    return errorResponse(e);
  }
}
