import { PaymentError } from "./errors.js";
import type { PaymentActor } from "./service.js";

// ---------------------------------------------------------------------------
// Trust Profile & Reviews.
//
// A buyer rates a COMPLETED order (possession of slug+order_no authorizes it —
// the same discipline as filing a refund; buyers are guests with no account).
// One review per order (DB unique constraint). Each review recomputes the
// seller's derived trust_profiles row + appends a trust_events audit row via
// the recompute_trust_profile RPC. The seller reads their own profile through
// getSellerTrust; the public checkout page reads trust_profiles directly (it is
// publicly readable).
//
// ponytail: no wallet signature — a slug+order_no holder (the seller) could
// self-review, but only AFTER the order completed (funds already released) and
// only once. If that abuse ever appears, add the wallet-challenge proof used by
// release.ts. The rating is a trust signal, not a money path.
// ---------------------------------------------------------------------------

export interface OrderForReview {
  orderId: string;
  orderStatus: string;
  sellerProfileId: string;
  buyerUserId: string | null;
}

export interface TrustProfileRecord {
  sellerProfileId: string;
  totalOrders: number;
  completedOrders: number;
  refundedOrders: number;
  cancelledOrders: number;
  totalReviews: number;
  averageRating: string;
  refundRate: string;
  trustScore: string;
  level: string;
}

export interface ReviewRecord {
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface TrustEventRecord {
  eventType: string;
  scoreDelta: string;
  createdAt: string;
}

export interface SellerTrust {
  profile: TrustProfileRecord;
  reviews: ReviewRecord[];
  events: TrustEventRecord[];
}

export interface ReviewStore {
  /** Resolve an order by PUBLIC (slug, order_no) only — a raw UUID never
   * resolves. Returns null when the pair does not address a real order. */
  loadOrderForReview(input: {
    slug: string;
    orderNo: string;
  }): Promise<OrderForReview | null>;

  /** Insert the review (seller_profile_id / buyer_user_id come from the order
   * row, never client input). Throws AlreadyReviewed on the unique-order clash. */
  insertReview(input: {
    orderId: string;
    sellerProfileId: string;
    buyerUserId: string | null;
    rating: number;
    comment: string | null;
  }): Promise<{ reviewId: string }>;

  /** recompute_trust_profile RPC (shared with release/refund). */
  recomputeTrustProfile(
    orderId: string,
    eventType: "order_completed" | "order_refunded" | "review_received",
  ): Promise<void>;

  /** seller_profiles.id for an authenticated user, or null. */
  getSellerProfileIdForUser(userId: string): Promise<string | null>;

  /** The seller's trust_profiles row, or null when none exists yet. */
  loadTrustProfile(sellerProfileId: string): Promise<TrustProfileRecord | null>;

  listSellerReviews(
    sellerProfileId: string,
    limit: number,
  ): Promise<ReviewRecord[]>;

  listTrustEvents(
    sellerProfileId: string,
    limit: number,
  ): Promise<TrustEventRecord[]>;
}

export interface ReviewDeps {
  store: ReviewStore;
}

const notFound = () => new PaymentError("CheckoutNotFound", "order not found");

export interface SubmitReviewInput {
  slug: string;
  orderNo: string;
  rating: number;
  comment?: string;
}

/**
 * Submit a buyer review for a completed order. Eligible = the (slug, order_no)
 * addresses a real order whose status is 'completed'. One review per order;
 * a second attempt is a clean AlreadyReviewed (409). Missing/ineligible orders
 * share one generic 404 (no existence oracle).
 */
export async function submitReview(
  deps: ReviewDeps,
  input: SubmitReviewInput,
): Promise<{ reviewId: string; rating: number }> {
  const order = await deps.store.loadOrderForReview({
    slug: input.slug,
    orderNo: input.orderNo,
  });
  if (!order) throw notFound();
  if (order.orderStatus !== "completed") {
    // A review is only meaningful once the order is done (ERD rule #7).
    throw new PaymentError(
      "OrderNotEligible",
      "order is not completed yet",
    );
  }

  const { reviewId } = await deps.store.insertReview({
    orderId: order.orderId,
    sellerProfileId: order.sellerProfileId,
    buyerUserId: order.buyerUserId,
    rating: input.rating,
    comment: input.comment?.trim() || null,
  });

  // Fold the new review into the seller's derived trust profile. Best-effort:
  // the review is already saved and recompute is idempotent + self-healing.
  try {
    await deps.store.recomputeTrustProfile(order.orderId, "review_received");
  } catch {
    // intentionally ignored — recompute re-runs on the next trigger
  }

  return { reviewId, rating: input.rating };
}

/** A seller with no trust_profiles row yet reads as a fresh 'new' profile. */
function emptyProfile(sellerProfileId: string): TrustProfileRecord {
  return {
    sellerProfileId,
    totalOrders: 0,
    completedOrders: 0,
    refundedOrders: 0,
    cancelledOrders: 0,
    totalReviews: 0,
    averageRating: "0",
    refundRate: "0",
    trustScore: "0",
    level: "new",
  };
}

/** Seller reads their OWN trust profile + recent reviews + recent events. */
export async function getSellerTrust(
  deps: ReviewDeps,
  actor: PaymentActor,
): Promise<SellerTrust> {
  if (!actor.userId) {
    throw new PaymentError("Forbidden", "authentication required");
  }
  const sellerProfileId = await deps.store.getSellerProfileIdForUser(
    actor.userId,
  );
  if (!sellerProfileId) {
    throw new PaymentError("SellerNotReady", "no seller profile");
  }
  const [profile, reviews, events] = await Promise.all([
    deps.store.loadTrustProfile(sellerProfileId),
    deps.store.listSellerReviews(sellerProfileId, 20),
    deps.store.listTrustEvents(sellerProfileId, 20),
  ]);
  return {
    profile: profile ?? emptyProfile(sellerProfileId),
    reviews,
    events,
  };
}
