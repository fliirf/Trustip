import { describe, expect, it, vi } from "vitest";
import { PaymentError } from "../src/errors.js";
import {
  getSellerTrust,
  type OrderForReview,
  type ReviewDeps,
  type ReviewStore,
  submitReview,
} from "../src/reviews.js";
import type { PaymentActor } from "../src/service.js";

const SLUG = "cool-shirt";
const ORDER_NO = "TRP-TESTORDER0000001";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const SELLER_PROFILE_ID = "33333333-3333-4333-8333-333333333333";

function order(overrides: Partial<OrderForReview> = {}): OrderForReview {
  return {
    orderId: ORDER_ID,
    orderStatus: "completed",
    sellerProfileId: SELLER_PROFILE_ID,
    buyerUserId: null,
    ...overrides,
  };
}

function fakeStore(
  loaded: OrderForReview | null,
  overrides: Partial<ReviewStore> = {},
): ReviewStore {
  return {
    loadOrderForReview: vi.fn(async () => loaded),
    insertReview: vi.fn(async () => ({ reviewId: "review-1" })),
    recomputeTrustProfile: vi.fn(async () => {}),
    getSellerProfileIdForUser: vi.fn(async () => SELLER_PROFILE_ID),
    loadTrustProfile: vi.fn(async () => null),
    listSellerReviews: vi.fn(async () => []),
    listTrustEvents: vi.fn(async () => []),
    ...overrides,
  };
}

const deps = (store: ReviewStore): ReviewDeps => ({ store });
const input = { slug: SLUG, orderNo: ORDER_NO, rating: 5, comment: "great" };

describe("submitReview", () => {
  it("inserts the review and recomputes trust on a completed order", async () => {
    const store = fakeStore(order());
    const res = await submitReview(deps(store), input);
    expect(res).toEqual({ reviewId: "review-1", rating: 5 });
    expect(store.insertReview).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      sellerProfileId: SELLER_PROFILE_ID,
      buyerUserId: null,
      rating: 5,
      comment: "great",
    });
    expect(store.recomputeTrustProfile).toHaveBeenCalledWith(
      ORDER_ID,
      "review_received",
    );
  });

  it("404s (generic) when the (slug, order_no) pair resolves to nothing", async () => {
    const store = fakeStore(null);
    await expect(submitReview(deps(store), input)).rejects.toMatchObject({
      code: "CheckoutNotFound",
    });
    expect(store.insertReview).not.toHaveBeenCalled();
  });

  it("rejects a not-yet-completed order with OrderNotEligible", async () => {
    const store = fakeStore(order({ orderStatus: "shipped" }));
    await expect(submitReview(deps(store), input)).rejects.toMatchObject({
      code: "OrderNotEligible",
    });
    expect(store.insertReview).not.toHaveBeenCalled();
  });

  it("propagates AlreadyReviewed from the unique-order clash", async () => {
    const store = fakeStore(order(), {
      insertReview: vi.fn(async () => {
        throw new PaymentError("AlreadyReviewed", "already reviewed");
      }),
    });
    await expect(submitReview(deps(store), input)).rejects.toMatchObject({
      code: "AlreadyReviewed",
    });
    expect(store.recomputeTrustProfile).not.toHaveBeenCalled();
  });

  it("still succeeds when the best-effort recompute throws", async () => {
    const store = fakeStore(order(), {
      recomputeTrustProfile: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    const res = await submitReview(deps(store), input);
    expect(res.reviewId).toBe("review-1");
  });
});

describe("getSellerTrust", () => {
  const actor: PaymentActor = { userId: "user-1" };

  it("returns an empty 'new' profile when none exists yet", async () => {
    const store = fakeStore(null);
    const trust = await getSellerTrust(deps(store), actor);
    expect(trust.profile.level).toBe("new");
    expect(trust.profile.sellerProfileId).toBe(SELLER_PROFILE_ID);
    expect(trust.reviews).toEqual([]);
    expect(trust.events).toEqual([]);
  });

  it("forbids an unauthenticated actor", async () => {
    const store = fakeStore(null);
    await expect(
      getSellerTrust(deps(store), { userId: null }),
    ).rejects.toMatchObject({ code: "Forbidden" });
  });

  it("SellerNotReady when the user has no seller profile", async () => {
    const store = fakeStore(null, {
      getSellerProfileIdForUser: vi.fn(async () => null),
    });
    await expect(getSellerTrust(deps(store), actor)).rejects.toMatchObject({
      code: "SellerNotReady",
    });
  });
});
