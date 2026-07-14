import { describe, expect, it, vi } from "vitest";
import {
  addPayoutMethod,
  disablePayoutMethod,
  listPayoutMethods,
  type PayoutMethodDeps,
  type PayoutMethodRecord,
  type PayoutMethodStore,
  setDefaultPayoutMethod,
} from "../src/payout-methods.js";
import type { PaymentActor } from "../src/service.js";

const USER = "user-1";
const SELLER = "seller-1";
const WALLET = "44444444-4444-4444-8444-444444444444";
const METHOD = "55555555-5555-4555-8555-555555555555";
const actor: PaymentActor = { userId: USER };

function record(overrides: Partial<PayoutMethodRecord> = {}): PayoutMethodRecord {
  return {
    id: METHOD,
    methodType: "usdc_wallet",
    displayName: "Main",
    isDefault: false,
    status: "active",
    stellarAddress: "G" + "A".repeat(55),
    assetCode: "USDC",
    cashoutCountry: null,
    cashoutCurrency: null,
    createdAt: "2026-07-15T00:00:00Z",
    ...overrides,
  };
}

function fakeStore(overrides: Partial<PayoutMethodStore> = {}): PayoutMethodStore {
  return {
    getSellerProfileIdForUser: vi.fn(async () => SELLER),
    findVerifiedWallet: vi.fn(async () => ({ publicKey: "G" + "A".repeat(55) })),
    listPayoutMethods: vi.fn(async () => []),
    insertPayoutMethod: vi.fn(async (i) =>
      record({ methodType: i.methodType, displayName: i.displayName, status: i.status }),
    ),
    setDefaultPayoutMethod: vi.fn(async () => ({ applied: true })),
    disablePayoutMethod: vi.fn(async () => ({ applied: true })),
    ...overrides,
  };
}

const deps = (store: PayoutMethodStore): PayoutMethodDeps => ({ store });

describe("addPayoutMethod", () => {
  it("registers a USDC method against a verified wallet", async () => {
    const store = fakeStore();
    const res = await addPayoutMethod(deps(store), actor, {
      methodType: "usdc_wallet",
      displayName: "Main",
      walletId: WALLET,
    });
    expect(res.methodType).toBe("usdc_wallet");
    expect(store.findVerifiedWallet).toHaveBeenCalledWith({
      userId: USER,
      walletId: WALLET,
    });
    expect(store.insertPayoutMethod).toHaveBeenCalledWith(
      expect.objectContaining({ assetCode: "USDC", status: "active" }),
    );
  });

  it("rejects a wallet the seller has not verified", async () => {
    const store = fakeStore({ findVerifiedWallet: vi.fn(async () => null) });
    await expect(
      addPayoutMethod(deps(store), actor, {
        methodType: "usdc_wallet",
        displayName: "Main",
        walletId: WALLET,
      }),
    ).rejects.toMatchObject({ code: "WalletNotFound" });
    expect(store.insertPayoutMethod).not.toHaveBeenCalled();
  });

  it("registers MoneyGram as a guided needs_review route with no wallet", async () => {
    const store = fakeStore();
    await addPayoutMethod(deps(store), actor, {
      methodType: "moneygram_cashout",
      displayName: "Cash-out",
      cashoutCountry: "ID",
      cashoutCurrency: "IDR",
    });
    expect(store.findVerifiedWallet).not.toHaveBeenCalled();
    expect(store.insertPayoutMethod).toHaveBeenCalledWith(
      expect.objectContaining({
        methodType: "moneygram_cashout",
        status: "needs_review",
        walletId: null,
        cashoutCountry: "ID",
      }),
    );
  });

  it("sets the new method as default when requested", async () => {
    const store = fakeStore();
    const res = await addPayoutMethod(deps(store), actor, {
      methodType: "xlm_wallet",
      displayName: "XLM",
      walletId: WALLET,
      isDefault: true,
    });
    expect(store.setDefaultPayoutMethod).toHaveBeenCalled();
    expect(res.isDefault).toBe(true);
  });

  it("SellerNotReady when the user has no seller profile", async () => {
    const store = fakeStore({
      getSellerProfileIdForUser: vi.fn(async () => null),
    });
    await expect(
      addPayoutMethod(deps(store), actor, {
        methodType: "usdc_wallet",
        displayName: "Main",
        walletId: WALLET,
      }),
    ).rejects.toMatchObject({ code: "SellerNotReady" });
  });
});

describe("setDefaultPayoutMethod", () => {
  it("rejects an ineligible (disabled/foreign) method", async () => {
    const store = fakeStore({
      setDefaultPayoutMethod: vi.fn(async () => ({ applied: false })),
    });
    await expect(
      setDefaultPayoutMethod(deps(store), actor, METHOD),
    ).rejects.toMatchObject({ code: "OrderNotEligible" });
  });
});

describe("disablePayoutMethod", () => {
  it("404s when the method is not the seller's", async () => {
    const store = fakeStore({
      disablePayoutMethod: vi.fn(async () => ({ applied: false })),
    });
    await expect(
      disablePayoutMethod(deps(store), actor, METHOD),
    ).rejects.toMatchObject({ code: "OrderNotFound" });
  });
});

describe("listPayoutMethods", () => {
  it("returns [] for a user with no seller profile (not an error)", async () => {
    const store = fakeStore({
      getSellerProfileIdForUser: vi.fn(async () => null),
    });
    expect(await listPayoutMethods(deps(store), actor)).toEqual([]);
  });
});
