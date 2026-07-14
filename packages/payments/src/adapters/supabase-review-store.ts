import type { TrustipClient } from "@trustip/database";
import { PaymentError } from "../errors.js";
import type {
  ReviewRecord,
  ReviewStore,
  TrustEventRecord,
  TrustProfileRecord,
} from "../reviews.js";

/**
 * SERVICE-ROLE adapter for the Trust Profile & Reviews store port. Server-only —
 * clients hold no DML grants on reviews/trust_profiles/trust_events, so this
 * adapter (behind the guarded service) is the only review write path. The
 * derived profile is written exclusively through the recompute_trust_profile
 * RPC, never by direct UPDATE.
 */
export function createSupabaseReviewStore(client: TrustipClient): ReviewStore {
  return {
    async loadOrderForReview({ slug, orderNo }) {
      // PUBLIC identifiers only — the order must belong to that exact link.
      const { data: link, error: linkError } = await client
        .from("checkout_links")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (linkError) throw linkError;
      if (!link) return null;

      const { data: order, error: orderError } = await client
        .from("orders")
        .select("id, status, seller_profile_id, buyer_user_id, checkout_link_id")
        .eq("order_no", orderNo)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order || order.checkout_link_id !== link.id) return null;

      return {
        orderId: order.id,
        orderStatus: order.status,
        sellerProfileId: order.seller_profile_id,
        buyerUserId: order.buyer_user_id,
      };
    },

    async insertReview({
      orderId,
      sellerProfileId,
      buyerUserId,
      rating,
      comment,
    }) {
      const { data, error } = await client
        .from("reviews")
        .insert({
          order_id: orderId,
          seller_profile_id: sellerProfileId,
          buyer_user_id: buyerUserId,
          rating,
          comment,
        })
        .select("id")
        .single();
      if (error) {
        // unique(order_id) → one review per order.
        if ((error as { code?: string }).code === "23505") {
          throw new PaymentError(
            "AlreadyReviewed",
            "this order has already been reviewed",
          );
        }
        throw error;
      }
      return { reviewId: data.id };
    },

    async recomputeTrustProfile(orderId, eventType) {
      const { error } = await client.rpc("recompute_trust_profile", {
        p_order_id: orderId,
        p_event_type: eventType,
      });
      if (error) throw error;
    },

    async getSellerProfileIdForUser(userId) {
      const { data, error } = await client
        .from("seller_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },

    async loadTrustProfile(sellerProfileId) {
      const { data, error } = await client
        .from("trust_profiles")
        .select(
          `seller_profile_id, total_orders, completed_orders, refunded_orders,
           cancelled_orders, total_reviews, average_rating, refund_rate,
           trust_score, level`,
        )
        .eq("seller_profile_id", sellerProfileId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return toTrustProfile(data);
    },

    async listSellerReviews(sellerProfileId, limit) {
      const { data, error } = await client
        .from("reviews")
        .select("rating, comment, created_at")
        .eq("seller_profile_id", sellerProfileId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map(
        (r): ReviewRecord => ({
          rating: r.rating,
          comment: r.comment,
          createdAt: r.created_at,
        }),
      );
    },

    async listTrustEvents(sellerProfileId, limit) {
      const { data, error } = await client
        .from("trust_events")
        .select(
          "event_type, score_delta, created_at, trust_profiles!inner ( seller_profile_id )",
        )
        .eq("trust_profiles.seller_profile_id", sellerProfileId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map(
        (e): TrustEventRecord => ({
          eventType: e.event_type,
          scoreDelta: String(e.score_delta),
          createdAt: e.created_at,
        }),
      );
    },
  };
}

function toTrustProfile(row: {
  seller_profile_id: string;
  total_orders: number;
  completed_orders: number;
  refunded_orders: number;
  cancelled_orders: number;
  total_reviews: number;
  average_rating: number;
  refund_rate: number;
  trust_score: number;
  level: string;
}): TrustProfileRecord {
  return {
    sellerProfileId: row.seller_profile_id,
    totalOrders: row.total_orders,
    completedOrders: row.completed_orders,
    refundedOrders: row.refunded_orders,
    cancelledOrders: row.cancelled_orders,
    totalReviews: row.total_reviews,
    averageRating: String(row.average_rating),
    refundRate: String(row.refund_rate),
    trustScore: String(row.trust_score),
    level: row.level,
  };
}
