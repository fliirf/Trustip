// Seller checkout links: list / create. Creation requires full checkout
// readiness (profile + verified primary wallet on the configured network) so
// no link can exist whose orders would immediately fail seller-wallet
// resolution. sellerProfileId and status are always server-derived.
import {
  createSellerCheckoutLink,
  listSellerCheckoutLinks,
} from "@trustip/payments";
import { createSellerCheckoutLinkSchema } from "@trustip/validators";
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
    const links = await listSellerCheckoutLinks(getSellerDeps(), actor);
    return NextResponse.json({ links });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const limited = enforceSellerRateLimit(request);
  if (limited) return limited;
  try {
    const actor = await getActor(request);
    const input = await parseJsonBody(request, createSellerCheckoutLinkSchema);
    const link = await createSellerCheckoutLink(getSellerDeps(), actor, input);
    return NextResponse.json(link, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
