// Seller orders: READ-ONLY list of orders from the seller's own checkout
// links (scoped by the service-derived seller profile — never client input).
// No lifecycle mutation exists here; shipment/release/refund are later phases.
import { listSellerOrders } from "@trustip/payments";
import { NextResponse } from "next/server";
import {
  enforceSellerRateLimit,
  errorResponse,
  getActor,
} from "../../_lib/payments";
import { getSellerDeps } from "../../_lib/seller";

export async function GET(request: Request): Promise<NextResponse> {
  const limited = enforceSellerRateLimit(request);
  if (limited) return limited;
  try {
    const actor = await getActor(request);
    const orders = await listSellerOrders(getSellerDeps(), actor);
    return NextResponse.json({ orders });
  } catch (e) {
    return errorResponse(e);
  }
}
