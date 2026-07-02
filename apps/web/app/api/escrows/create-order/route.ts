import { ensureOnChainEscrowOrderCreated } from "@trustip/payments";
import { createEscrowOrderSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceCreateOrderRateLimit,
  errorResponse,
  getActor,
  getPaymentDeps,
  parseJsonBody,
} from "../../_lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/escrows/create-order
 * Ensure the on-chain escrow order exists in Created state for the connected
 * buyer wallet, BEFORE fund prepare/submit. Authorized fail-closed in the
 * service: the caller must present a valid server-signed checkout token (guest)
 * OR be the authenticated order owner / admin — a raw orderId + buyer key is
 * never enough to trigger operator signing. Idempotent — duplicate calls
 * reconcile rather than creating a second on-chain order. Amount, seller and
 * status are server-derived; the admin/operator secret is never returned. Does
 * not mark paid, submit fund_order, or bypass sync.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const limited = enforceCreateOrderRateLimit(request);
    if (limited) return limited;
    const input = await parseJsonBody(request, createEscrowOrderSchema);
    const actor = await getActor(request);
    const result = await ensureOnChainEscrowOrderCreated(
      getPaymentDeps(),
      input,
      actor,
    );
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
