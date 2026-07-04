// Verify wallet ownership: checks the HMAC challenge token (user/key/network/
// nonce/expiry) and the wallet's real signature over the network-bound
// transaction hash. ONLY on success does the service-role store set
// verified_at — no client claim is trusted, ever.
import { verifySellerWallet } from "@trustip/payments";
import { verifyWalletChallengeSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceSellerRateLimit,
  errorResponse,
  getActor,
  parseJsonBody,
} from "../../../_lib/payments";
import { getSellerDeps } from "../../../_lib/seller";

export async function POST(request: Request): Promise<NextResponse> {
  const limited = enforceSellerRateLimit(request);
  if (limited) return limited;
  try {
    const actor = await getActor(request);
    const input = await parseJsonBody(request, verifyWalletChallengeSchema);
    const wallet = await verifySellerWallet(getSellerDeps(), actor, input);
    return NextResponse.json(wallet);
  } catch (e) {
    return errorResponse(e);
  }
}
