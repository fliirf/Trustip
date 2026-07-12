import { issueCheckoutChallenge } from "@trustip/payments";
import { issueCheckoutChallengeSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceCheckoutIssueRateLimit,
  errorResponse,
  getPaymentDeps,
  parseJsonBody,
} from "../../../_lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/token/challenge
 * Mint an unsigned SEP-10-style wallet-ownership challenge for the buyer key,
 * plus a short-lived HMAC token binding it to {slug, orderNo, key, network}.
 * The buyer wallet signs the challenge and passes both back to
 * /api/checkout/token, which verifies the proof before minting the checkout
 * token. Does NO store read (not an order_no oracle). Fails closed when
 * TRUSTIP_WALLET_CHALLENGE_SECRET is unset.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const limited = enforceCheckoutIssueRateLimit(request);
    if (limited) return limited;
    const input = await parseJsonBody(request, issueCheckoutChallengeSchema);
    const result = await issueCheckoutChallenge(getPaymentDeps(), input);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
