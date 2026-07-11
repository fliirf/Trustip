import { describe, expect, it } from "vitest";
import type { TrustipClient } from "@trustip/database";
import { createSupabaseSellerStore } from "../src/adapters/supabase-seller-store.js";
import {
  isStoreError,
  PaymentError,
  toStoreError,
  unwrap,
} from "../src/errors.js";
import {
  getPublicOrderStatus,
  type SellerDeps,
  type SellerStore,
} from "../src/seller-onboarding.js";

// ---------------------------------------------------------------------------
// Phase 10B — backend error semantics. A store failure must never be reported
// as "not found": a buyer who has already paid would be told their order does
// not exist. 404 means the row is genuinely absent, and nothing else.
//
// The two error shapes below are copied from live supabase-js 2.108 responses:
//   - PostgREST container stopped  -> gateway 5xx, no `code`
//   - column does not exist        -> PostgrestError with SQLSTATE 42703
// ---------------------------------------------------------------------------

const OUTAGE = {
  message: "An invalid response was received from the upstream server",
} as const;

const BAD_QUERY = {
  code: "42703",
  message: "column checkout_links.no_such_column does not exist",
  details: "some internal detail",
  hint: null,
} as const;

type Result = { data: unknown; error: unknown };

/** Minimal chainable stand-in for the Supabase query builder. Every read
 * terminates in `maybeSingle()`; the queued results are returned in order. */
function fakeClient(results: Result[]): {
  client: TrustipClient;
  writes: string[];
} {
  const queue = [...results];
  const writes: string[] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit", "not", "is"]) {
    chain[method] = () => chain;
  }
  for (const method of ["insert", "update", "upsert", "delete"]) {
    chain[method] = () => {
      writes.push(method);
      return chain;
    };
  }
  chain.maybeSingle = () =>
    Promise.resolve(queue.shift() ?? { data: null, error: null });
  chain.single = chain.maybeSingle;
  // A bare `await` on the builder (list queries) resolves the same way.
  chain.then = (resolve: (v: Result) => unknown) =>
    resolve(queue.shift() ?? { data: null, error: null });

  return {
    client: { from: () => chain } as unknown as TrustipClient,
    writes,
  };
}

function sellerDeps(store: SellerStore): SellerDeps {
  return {
    store,
    config: {
      networkName: "testnet",
      networkPassphrase: "passphrase",
      walletChallengeSecret: "secret",
    },
    payoutReadiness: { check: async () => ({ accountExists: true, usdcTrustline: true }) },
  } as unknown as SellerDeps;
}

describe("toStoreError — classification", () => {
  it("maps a dependency that never answered to a retryable 503", () => {
    const err = toStoreError(OUTAGE);
    expect(err.code).toBe("ServiceUnavailable");
    expect(err.httpStatus).toBe(503);
  });

  it("maps an empty code (transport failure) to 503", () => {
    const err = toStoreError({ code: "", message: "TypeError: fetch failed" });
    expect(err.code).toBe("ServiceUnavailable");
    expect(err.httpStatus).toBe(503);
  });

  it("maps a SQLSTATE (the database answered) to a non-retryable 500", () => {
    const err = toStoreError(BAD_QUERY);
    expect(err.code).toBe("InternalError");
    expect(err.httpStatus).toBe(500);
  });

  it("never leaks database internals into the client-facing message", () => {
    for (const raw of [OUTAGE, BAD_QUERY]) {
      const { message } = toStoreError(raw);
      expect(message).not.toContain("column");
      expect(message).not.toContain("upstream");
      expect(message).not.toContain("some internal detail");
    }
    // The raw error survives for server-side logs only.
    expect(toStoreError(BAD_QUERY).cause).toBe(BAD_QUERY);
  });

  it("passes an existing PaymentError through untouched", () => {
    const original = new PaymentError("CheckoutNotFound", "order not found");
    expect(toStoreError(original)).toBe(original);
  });

  it("does not mistake an ordinary Error for a store error", () => {
    expect(isStoreError(new TypeError("boom"))).toBe(false);
    expect(isStoreError(OUTAGE)).toBe(true);
  });
});

describe("unwrap", () => {
  it("returns data when there is no error", () => {
    expect(unwrap({ data: { id: "x" }, error: null })).toEqual({ id: "x" });
  });

  it("throws rather than yielding null when the store failed", () => {
    expect(() => unwrap({ data: null, error: OUTAGE })).toThrow(PaymentError);
  });
});

describe("getPublicOrderStatus — store adapter under failure", () => {
  it("reports 404 only when the order is genuinely absent", async () => {
    const store = {
      getPublicOrderStatus: async () => null,
    } as unknown as SellerStore;

    await expect(
      getPublicOrderStatus(sellerDeps(store), {
        slug: "s",
        orderNo: "TRP-1",
      }),
    ).rejects.toMatchObject({ code: "CheckoutNotFound", httpStatus: 404 });
  });

  it("surfaces 503 — not 404 — when the checkout_links read fails", async () => {
    const { client, writes } = fakeClient([{ data: null, error: OUTAGE }]);

    await expect(
      createSupabaseSellerStore(client).getPublicOrderStatus({
        slug: "s",
        orderNo: "TRP-1",
      }),
    ).rejects.toMatchObject({ code: "ServiceUnavailable", httpStatus: 503 });

    // A failed READ must not touch payment/escrow state.
    expect(writes).toEqual([]);
  });

  it("surfaces 503 when the orders read fails after the link resolves", async () => {
    const { client, writes } = fakeClient([
      { data: { id: "link-1", slug: "s" }, error: null },
      { data: null, error: OUTAGE },
    ]);

    await expect(
      createSupabaseSellerStore(client).getPublicOrderStatus({
        slug: "s",
        orderNo: "TRP-1",
      }),
    ).rejects.toMatchObject({ code: "ServiceUnavailable", httpStatus: 503 });
    expect(writes).toEqual([]);
  });

  it("surfaces 500 when the database rejects the query", async () => {
    const { client } = fakeClient([{ data: null, error: BAD_QUERY }]);

    await expect(
      createSupabaseSellerStore(client).getPublicOrderStatus({
        slug: "s",
        orderNo: "TRP-1",
      }),
    ).rejects.toMatchObject({ code: "InternalError", httpStatus: 500 });
  });

  it("still returns null (-> 404) when the link is simply missing", async () => {
    const { client } = fakeClient([{ data: null, error: null }]);

    await expect(
      createSupabaseSellerStore(client).getPublicOrderStatus({
        slug: "nope",
        orderNo: "TRP-1",
      }),
    ).resolves.toBeNull();
  });
});
