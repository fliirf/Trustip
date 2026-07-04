// Seller wallets: list / register. Registration NEVER sets verified_at or
// is_primary — ownership is proven via challenge/verify, primary via /primary.
import { getSellerOnboarding, registerSellerWallet } from "@trustip/payments";
import { registerSellerWalletSchema } from "@trustip/validators";
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
    const { wallets } = await getSellerOnboarding(getSellerDeps(), actor);
    return NextResponse.json({ wallets });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const limited = enforceSellerRateLimit(request);
  if (limited) return limited;
  try {
    const actor = await getActor(request);
    const input = await parseJsonBody(request, registerSellerWalletSchema);
    const wallet = await registerSellerWallet(getSellerDeps(), actor, input);
    return NextResponse.json(wallet, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
