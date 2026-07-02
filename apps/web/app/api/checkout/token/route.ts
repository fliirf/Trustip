import { issueCheckoutToken } from "@trustip/payments";
import { issueCheckoutTokenSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceCheckoutIssueRateLimit,
  errorResponse,
  getPaymentDeps,
  parseJsonBody,
} from "../../_lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/token
 * Mint a short-lived, server-signed create-order token for GUEST checkout, from
 * a checkout-link context only (public slug + order number) after the buyer
 * connects a wallet. The token binds {orderId, buyerPublicKey, contractOrderId,
 * network}; amount/status/seller are never accepted from the client (unknown
 * keys are stripped by the schema) and stay server-derived + on-chain-verified
 * downstream. Fails closed when TRUSTIP_CHECKOUT_TOKEN_SECRET is unset. Does NOT
 * create an on-chain order, submit a tx, or mark anything paid.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const limited = enforceCheckoutIssueRateLimit(request);
    if (limited) return limited;
    const input = await parseJsonBody(request, issueCheckoutTokenSchema);
    const result = await issueCheckoutToken(getPaymentDeps(), input);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
