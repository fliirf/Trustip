import { ensureOnChainEscrowOrderCreated } from "@trustip/payments";
import { createEscrowOrderSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceRateLimit,
  errorResponse,
  getPaymentDeps,
  parseJsonBody,
} from "../../_lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/escrows/create-order
 * Admin/operator-authorized: ensure the on-chain escrow order exists in Created
 * state for the connected buyer wallet, BEFORE fund prepare/submit. Idempotent —
 * duplicate calls reconcile rather than creating a second on-chain order. Amount,
 * seller and status are server-derived; the admin secret is never returned. Does
 * not mark paid, submit fund_order, or bypass sync.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const limited = enforceRateLimit(request, "create-order");
    if (limited) return limited;
    const input = await parseJsonBody(request, createEscrowOrderSchema);
    const result = await ensureOnChainEscrowOrderCreated(
      getPaymentDeps(),
      input,
    );
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
