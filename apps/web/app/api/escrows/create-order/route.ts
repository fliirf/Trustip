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
    console.log("[create-order] Request received");

    const limited = await enforceCreateOrderRateLimit(request);

    if (limited) {
      console.warn("[create-order] Rate limited");
      return limited;
    }

    const input = await parseJsonBody(request, createEscrowOrderSchema);
    console.log("[create-order] Request body validated");

    const actor = await getActor(request);
    console.log("[create-order] Actor authorized");

    const result = await ensureOnChainEscrowOrderCreated(
      getPaymentDeps(),
      input,
      actor,
    );

    console.log("[create-order] On-chain order created successfully");

    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error("[create-order] FAILED:", e);

    if (e instanceof Error) {
      console.error("[create-order] MESSAGE:", e.message);

      if (e.stack) {
        console.error("[create-order] STACK:", e.stack);
      }

      if ("cause" in e && e.cause) {
        console.error("[create-order] CAUSE:", e.cause);
      }
    }

    return errorResponse(e);
  }
}