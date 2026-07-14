// Seller reads their OWN trust profile + recent reviews + trust events. Bearer
// auth (getActor); the service resolves the seller profile from the user id, so
// a seller can only ever see their own reputation. Read-only.
import { getSellerTrust } from "@trustip/payments";
import { NextResponse } from "next/server";
import {
  enforceSellerRateLimit,
  errorResponse,
  getActor,
} from "../../_lib/payments";
import { getReviewDeps } from "../../_lib/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const limited = enforceSellerRateLimit(request);
  if (limited) return limited;
  try {
    const actor = await getActor(request);
    const trust = await getSellerTrust(getReviewDeps(), actor);
    return NextResponse.json(trust);
  } catch (e) {
    return errorResponse(e);
  }
}
