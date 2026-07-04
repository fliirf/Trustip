// Promote a VERIFIED wallet on the configured network to the user's single
// primary payout wallet (demotes any other). Structural backstop: partial
// unique index on (user_id, network) where is_primary.
import { setPrimarySellerWallet } from "@trustip/payments";
import { setPrimaryWalletSchema } from "@trustip/validators";
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
    const input = await parseJsonBody(request, setPrimaryWalletSchema);
    const wallet = await setPrimarySellerWallet(getSellerDeps(), actor, input);
    return NextResponse.json(wallet);
  } catch (e) {
    return errorResponse(e);
  }
}
