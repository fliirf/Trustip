// Seller profile: read onboarding status / create-update the profile.
// Requires Authorization: Bearer <access_token>. All writes go through the
// service-role SellerStore — the client has no table DML grants.
import { getSellerOnboarding, saveSellerProfile } from "@trustip/payments";
import { sellerProfileSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceSellerRateLimit,
  errorResponse,
  getActor,
  parseJsonBody,
} from "../../_lib/payments";
import { getSellerDeps } from "../../_lib/seller";

export async function GET(request: Request): Promise<NextResponse> {
  const limited = enforceSellerRateLimit(request);
  if (limited) return limited;
  try {
    const actor = await getActor(request);
    const status = await getSellerOnboarding(getSellerDeps(), actor);
    return NextResponse.json(status);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const limited = enforceSellerRateLimit(request);
  if (limited) return limited;
  try {
    const actor = await getActor(request);
    const input = await parseJsonBody(request, sellerProfileSchema);
    const profile = await saveSellerProfile(getSellerDeps(), actor, {
      ...input,
      email: actor.email ?? null,
    });
    return NextResponse.json(profile, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
