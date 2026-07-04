// Issue a wallet-ownership challenge: an unsigned, non-submittable Stellar
// transaction + a short-lived HMAC token binding {user, key, network, nonce}.
// Fails closed (503) when TRUSTIP_WALLET_CHALLENGE_SECRET is unset.
import { issueWalletChallenge } from "@trustip/payments";
import { createWalletChallengeSchema } from "@trustip/validators";
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
    const input = await parseJsonBody(request, createWalletChallengeSchema);
    const challenge = await issueWalletChallenge(getSellerDeps(), actor, input);
    return NextResponse.json(challenge);
  } catch (e) {
    return errorResponse(e);
  }
}
