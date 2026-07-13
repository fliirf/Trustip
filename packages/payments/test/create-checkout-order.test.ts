import type { EscrowGateway } from "@trustip/stellar";
import { describe, expect, it } from "vitest";
import { pickSellerWalletId } from "../src/adapters/supabase-store.js";
import { PaymentError, type PaymentErrorCode } from "../src/errors.js";
import type { CheckoutLinkForOrder, PaymentStore } from "../src/ports.js";
import {
  createOrderFromCheckout,
  generateOrderNo,
  MAX_CHECKOUT_ORDER_QUANTITY,
  type PaymentConfig,
  type PaymentDeps,
} from "../src/service.js";

const CONFIG: PaymentConfig = {
  networkPassphrase: "Test SDF Network ; September 2015",
  networkName: "testnet",
  escrowContractId: "CDJO4D3R34KGLXHTD6ZVGERKOIKM66JVICY6RJABWWL2CXII7PCTBD3L",
};

const ORDER_NO_RE = /^TRP-[0-9A-HJKMNP-TV-Z]{16}$/;

async function rejectsWith(
  fn: () => Promise<unknown>,
  code: PaymentErrorCode,
): Promise<void> {
  try {
    await fn();
  } catch (e) {
    expect(e).toBeInstanceOf(PaymentError);
    expect((e as PaymentError).code).toBe(code);
    return;
  }
  throw new Error(`expected PaymentError(${code})`);
}

interface FakeInit {
  link?: Partial<CheckoutLinkForOrder> | null;
  /** How many insert attempts collide (return null) before succeeding. */
  collisions?: number;
  /** Resolved seller payout wallet id; null = seller has no valid wallet. */
  sellerWalletId?: string | null;
}

type InsertInput = Parameters<PaymentStore["insertCheckoutOrder"]>[0];

function makeStore(init: FakeInit = {}) {
  const link: CheckoutLinkForOrder | null =
    init.link === null
      ? null
      : {
          id: "link-1",
          sellerProfileId: "seller-1",
          title: "Nike Dunk Low",
          priceUsdc: "10.5",
          priceIdrReference: "150000.00",
          status: "active",
          expiresAt: null,
          requiresShipping: true,
          ...init.link,
        };
  const inserts: InsertInput[] = [];
  const walletQueries: Array<{ sellerProfileId: string; network: string }> = [];
  let remainingCollisions = init.collisions ?? 0;
  const sellerWalletId =
    init.sellerWalletId === undefined ? "wallet-1" : init.sellerWalletId;

  const notImplemented = async (): Promise<never> => {
    throw new Error("not implemented");
  };
  const store: PaymentStore = {
    loadByOrderId: notImplemented,
    loadByPaymentId: notImplemented,
    loadCheckoutOrderForIssuance: notImplemented,
    preparePaymentRow: notImplemented,
    linkEscrowRow: notImplemented,
    findPaymentByTxHash: notImplemented,
    recordSubmission: notImplemented,
    recordFundConfirmed: notImplemented,
    recordEscrowCreationTx: notImplemented,
    recordFailure: notImplemented,
    async loadCheckoutLinkBySlug(slug) {
      return link && slug === "shop-slug" ? link : null;
    },
    async resolveSellerWalletId(input) {
      walletQueries.push(input);
      return sellerWalletId;
    },
    async insertCheckoutOrder(input) {
      inserts.push(input);
      if (remainingCollisions > 0) {
        remainingCollisions -= 1;
        return null;
      }
      return { orderId: "order-1", orderNo: input.orderNo };
    },
  };
  return { store, inserts, walletQueries };
}

function deps(store: PaymentStore): PaymentDeps {
  return { store, gateway: {} as EscrowGateway, config: CONFIG };
}

const INPUT = {
  slug: "shop-slug",
  quantity: 3,
  buyerEmail: "buyer@example.com",
  buyerName: "Sari Buyer",
  shippingAddress: {
    name: "Sari Buyer",
    phone: "+62812345678",
    addressLine1: "Jl. Contoh 1",
    city: "Jakarta",
    postalCode: "12345",
    country: "ID",
  },
};

describe("createOrderFromCheckout", () => {
  it("creates an awaiting_payment order from an active link", async () => {
    const { store, inserts } = makeStore();
    const res = await createOrderFromCheckout(deps(store), INPUT);
    expect(res).toEqual({
      orderId: "order-1",
      orderNo: expect.stringMatching(ORDER_NO_RE),
      status: "awaiting_payment",
      totalUsdc: "31.5",
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      checkoutLinkId: "link-1",
      sellerProfileId: "seller-1",
      totalUsdc: "31.5",
      totalIdrReference: "450000",
      item: {
        name: "Nike Dunk Low",
        quantity: 3,
        unitPriceUsdc: "10.5",
        subtotalUsdc: "31.5",
        metadata: {
          buyerEmail: INPUT.buyerEmail,
          buyerName: INPUT.buyerName,
          shippingAddress: INPUT.shippingAddress,
        },
      },
    });
  });

  it("derives the amount from the link, never the client", async () => {
    const { store, inserts } = makeStore({ link: { priceUsdc: "0.0000001" } });
    const res = await createOrderFromCheckout(deps(store), {
      ...INPUT,
      // hostile extra fields are not part of the input type — the derived total
      // is exact 7-decimal integer-unit math on the LINK price only.
      quantity: 3,
    });
    expect(res.totalUsdc).toBe("0.0000003");
    expect(inserts[0]!.totalUsdc).toBe("0.0000003");
  });

  it("rejects an unknown slug as CheckoutNotFound", async () => {
    const { store } = makeStore({ link: null });
    await rejectsWith(
      () => createOrderFromCheckout(deps(store), INPUT),
      "CheckoutNotFound",
    );
  });

  it("rejects an inactive link", async () => {
    const { store } = makeStore({ link: { status: "inactive" } });
    await rejectsWith(
      () => createOrderFromCheckout(deps(store), INPUT),
      "CheckoutNotAvailable",
    );
  });

  it("rejects an expired link", async () => {
    const { store } = makeStore({
      link: { expiresAt: "2020-01-01T00:00:00Z" },
    });
    await rejectsWith(
      () => createOrderFromCheckout(deps(store), INPUT),
      "CheckoutNotAvailable",
    );
  });

  it("rejects a quantity above the cap and non-integers", async () => {
    const { store } = makeStore();
    await rejectsWith(
      () =>
        createOrderFromCheckout(deps(store), {
          ...INPUT,
          quantity: MAX_CHECKOUT_ORDER_QUANTITY + 1,
        }),
      "InvalidInput",
    );
    await rejectsWith(
      () => createOrderFromCheckout(deps(store), { ...INPUT, quantity: 1.5 }),
      "InvalidInput",
    );
    await rejectsWith(
      () => createOrderFromCheckout(deps(store), { ...INPUT, quantity: 0 }),
      "InvalidInput",
    );
  });

  it("retries order_no collisions with fresh numbers, then succeeds", async () => {
    const { store, inserts } = makeStore({ collisions: 2 });
    const res = await createOrderFromCheckout(deps(store), INPUT);
    expect(res.orderNo).toMatch(ORDER_NO_RE);
    expect(inserts).toHaveLength(3);
    // every retry used a distinct order_no
    expect(new Set(inserts.map((i) => i.orderNo)).size).toBe(3);
  });

  it("fails with Conflict when collision retries are exhausted", async () => {
    const { store } = makeStore({ collisions: 99 });
    await rejectsWith(
      () => createOrderFromCheckout(deps(store), INPUT),
      "Conflict",
    );
  });

  it("stores the resolved seller wallet id on the order", async () => {
    const { store, inserts } = makeStore({ sellerWalletId: "wallet-42" });
    await createOrderFromCheckout(deps(store), INPUT);
    expect(inserts[0]!.sellerWalletId).toBe("wallet-42");
  });

  it("resolves the seller wallet from the LINK's seller on the SERVER network — never from client input", async () => {
    const { store, inserts, walletQueries } = makeStore();
    await createOrderFromCheckout(deps(store), INPUT);
    // the input type carries no wallet field; resolution used only link + config
    expect(walletQueries).toEqual([
      { sellerProfileId: "seller-1", network: CONFIG.networkName },
    ]);
    expect(inserts[0]!.sellerWalletId).toBe("wallet-1");
  });

  it("rejects order creation when the seller has no valid payout wallet (no unpayable order row)", async () => {
    const { store, inserts } = makeStore({ sellerWalletId: null });
    await rejectsWith(
      () => createOrderFromCheckout(deps(store), INPUT),
      "CheckoutNotAvailable",
    );
    expect(inserts).toHaveLength(0);
  });
});

describe("pickSellerWalletId", () => {
  it("chooses the single primary wallet among several", () => {
    expect(
      pickSellerWalletId([
        { id: "a", is_primary: false },
        { id: "b", is_primary: true },
        { id: "c", is_primary: false },
      ]),
    ).toBe("b");
  });

  it("chooses the only wallet when none is primary", () => {
    expect(pickSellerWalletId([{ id: "a", is_primary: false }])).toBe("a");
  });

  it("fails closed on ambiguity or no candidates", () => {
    // rows arrive pre-filtered to verified wallets on the target network, so
    // an empty list means no verified/network-matching wallet exists
    expect(pickSellerWalletId([])).toBeNull();
    expect(
      pickSellerWalletId([
        { id: "a", is_primary: false },
        { id: "b", is_primary: false },
      ]),
    ).toBeNull();
    expect(
      pickSellerWalletId([
        { id: "a", is_primary: true },
        { id: "b", is_primary: true },
      ]),
    ).toBeNull();
  });
});

describe("generateOrderNo", () => {
  it("emits high-entropy, unique, format-stable order numbers", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const no = generateOrderNo();
      expect(no).toMatch(ORDER_NO_RE);
      seen.add(no);
    }
    expect(seen.size).toBe(1000);
  });
});
