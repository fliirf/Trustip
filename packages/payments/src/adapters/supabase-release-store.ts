import type { TrustipClient } from "@trustip/database";
import { usdcAmountToString } from "../money.js";
import type { ReleaseContext, ReleaseStore } from "../release.js";

// Refund statuses that BLOCK release (anything still undecided or decided
// against the seller). rejected = refund denied, release may proceed;
// completed = refund already executed (escrow refunded, guards fail anyway).
const OPEN_REFUND_STATUSES = new Set([
  "submitted",
  "under_review",
  "seller_response_needed",
  "approved",
]);

/** Canonical decimal string sent through a numeric column/arg — PostgREST
 * casts string→numeric server-side, so no JS float precision is lost. */
function moneyValue(amount: string): number {
  return usdcAmountToString(amount) as unknown as number;
}

/**
 * SERVICE-ROLE adapter for the RELEASE-1 store port. Server-only — clients
 * hold no DML grants on orders/escrows/shipments/blockchain_transactions, so
 * this adapter (behind the guarded service) is the only release write path.
 */
export function createSupabaseReleaseStore(
  client: TrustipClient,
): ReleaseStore {
  return {
    async loadReleaseContext({ slug, orderNo }) {
      // PUBLIC identifiers only, mirroring getPublicOrderStatus: the order must
      // belong to that exact checkout link or nothing resolves.
      const { data: link, error: linkError } = await client
        .from("checkout_links")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (linkError) throw linkError;
      if (!link) return null;

      const { data: order, error: orderError } = await client
        .from("orders")
        .select(
          `id, order_no, status, checkout_link_id,
           payments ( status ),
           escrows ( id, status, contract_order_id, buyer_public_key,
                     seller_public_key, amount_usdc, release_tx_hash ),
           shipments ( status, created_at ),
           refund_requests ( status )`,
        )
        .eq("order_no", orderNo)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order || order.checkout_link_id !== link.id) return null;

      type Row = {
        id: string;
        order_no: string;
        status: string;
        payments: { status: string } | null;
        escrows: {
          id: string;
          status: string;
          contract_order_id: string | null;
          buyer_public_key: string | null;
          seller_public_key: string | null;
          amount_usdc: number;
          release_tx_hash: string | null;
        } | null;
        shipments: Array<{ status: string; created_at: string }> | null;
        refund_requests: Array<{ status: string }> | null;
      };
      const row = order as unknown as Row;

      const latestShipment =
        (row.shipments ?? [])
          .slice()
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

      const context: ReleaseContext = {
        orderId: row.id,
        orderNo: row.order_no,
        orderStatus: row.status,
        paymentStatus: row.payments?.status ?? null,
        shipmentStatus: latestShipment?.status ?? null,
        escrow: row.escrows
          ? {
              id: row.escrows.id,
              status: row.escrows.status,
              contractOrderId: row.escrows.contract_order_id,
              buyerPublicKey: row.escrows.buyer_public_key,
              sellerPublicKey: row.escrows.seller_public_key,
              amountUsdc: usdcAmountToString(row.escrows.amount_usdc),
              releaseTxHash: row.escrows.release_tx_hash,
            }
          : null,
        hasOpenRefundRequest: (row.refund_requests ?? []).some((r) =>
          OPEN_REFUND_STATUSES.has(r.status),
        ),
      };
      return context;
    },

    async markOrderDelivered({ orderId, deliveredAt }) {
      // Guarded single-step transition — a concurrent writer wins.
      const { data: updated, error: orderError } = await client
        .from("orders")
        .update({ status: "delivered" })
        .eq("id", orderId)
        .eq("status", "shipped")
        .select("id");
      if (orderError) throw orderError;
      if (!updated || updated.length === 0) return { applied: false };

      const { error: shipmentError } = await client
        .from("shipments")
        .update({ status: "delivered", delivered_at: deliveredAt })
        .eq("order_id", orderId);
      if (shipmentError) throw shipmentError;

      const { error: eventError } = await client
        .from("order_status_events")
        .insert({
          order_id: orderId,
          status: "delivered",
          actor_type: "buyer",
          metadata: { via: "confirm_received" },
        });
      if (eventError) throw eventError;
      return { applied: true };
    },

    async recordReleaseSubmitted(input) {
      const { error } = await client.from("blockchain_transactions").upsert(
        {
          order_id: input.orderId,
          escrow_id: input.escrowId,
          tx_hash: input.txHash,
          tx_type: "escrow_release",
          network: input.network,
          status: "submitted",
          source_account: input.sourceAccount,
          amount: moneyValue(input.amountUsdc),
          asset_code: "USDC",
        },
        { onConflict: "tx_hash", ignoreDuplicates: true },
      );
      if (error) throw error;
    },

    async findReleaseTxHash(orderId) {
      const { data, error } = await client
        .from("blockchain_transactions")
        .select("tx_hash")
        .eq("order_id", orderId)
        .eq("tx_type", "escrow_release")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.tx_hash ?? null;
    },

    async confirmReleased(input) {
      // Same boundary discipline as confirm_funded_payment: p_amount_usdc is
      // sent as a canonical STRING (PostgREST casts string→numeric, no float
      // drift) and p_ledger/p_to_public_key are nullable at runtime though the
      // generated arg types are non-null.
      const { data, error } = await client.rpc("confirm_released_payment", {
        p_order_id: input.orderId,
        p_escrow_id: input.escrowId,
        p_tx_hash: input.txHash,
        p_ledger: input.ledger as number,
        p_to_public_key: input.toPublicKey as string,
        p_amount_usdc: moneyValue(input.amountUsdc),
        p_network: input.network,
      });
      if (error) throw error;
      return { applied: data === true };
    },

    async recomputeTrustProfile(orderId, eventType) {
      const { error } = await client.rpc("recompute_trust_profile", {
        p_order_id: orderId,
        p_event_type: eventType,
      });
      if (error) throw error;
    },
  };
}
