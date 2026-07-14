// Admin refund queue (REFUND-2). Requires Authorization: Bearer <access_token>
// resolving to users.role = 'admin' — enforced in the service, fail closed.
import { listRefundRequests } from "@trustip/payments";
import { NextResponse } from "next/server";
import {
  enforceRateLimit,
  errorResponse,
  getActor,
} from "../../_lib/payments";
import { getRefundDeps } from "../../_lib/refund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const limited = enforceRateLimit(request, "admin-refunds");
  if (limited) return limited;
  try {
    const actor = await getActor(request);
    const url = new URL(request.url);
    const rows = await listRefundRequests(getRefundDeps(), actor, {
      onlyOpen: url.searchParams.get("all") !== "1",
    });
    return NextResponse.json({ refunds: rows });
  } catch (e) {
    return errorResponse(e);
  }
}
