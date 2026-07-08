// Seller shipment lifecycle write (Phase 8A) — the first and ONLY seller
// lifecycle mutation. Ownership is derived server-side from the bearer token
// (profile → orders.seller_profile_id); the client cannot name a seller or
// touch payment/escrow state. Transitions are strict single-step forward:
// escrow_locked → processing → packed → shipped, escrow must be funded.
import { PaymentError, updateSellerShipment } from "@trustip/payments";
import { orderNoSchema, updateShipmentStatusSchema } from "@trustip/validators";
import { NextResponse } from "next/server";
import {
  enforceSellerRateLimit,
  errorResponse,
  getActor,
} from "../../../../_lib/payments";
import { getSellerDeps } from "../../../../_lib/seller";

export async function POST(
  request: Request,
  context: { params: Promise<{ orderNo: string }> },
): Promise<NextResponse> {
  const limited = enforceSellerRateLimit(request);
  if (limited) return limited;
  try {
    const actor = await getActor(request);
    const rawParams = await context.params;
    const orderNo = orderNoSchema.safeParse(rawParams.orderNo);
    if (!orderNo.success) {
      throw new PaymentError("OrderNotFound", "order not found");
    }
    const body = updateShipmentStatusSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!body.success) {
      throw new PaymentError("InvalidInput", "invalid shipment update");
    }
    const result = await updateSellerShipment(getSellerDeps(), actor, {
      orderNo: orderNo.data,
      ...body.data,
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
