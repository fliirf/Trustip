import type { PathPaymentGateway } from "@trustip/stellar";
import { describe, expect, it, vi } from "vitest";
import {
  type ConversionContext,
  type ConversionDeps,
  type ConversionStore,
  prepareXlmConversion,
  submitXlmConversion,
} from "../src/payout-conversion.js";
import type { PaymentActor } from "../src/service.js";

const SELLER = "seller-1";
const PAYOUT = "66666666-6666-4666-8666-666666666666";
const SOURCE = "G" + "A".repeat(55);
const actor: PaymentActor = { userId: "user-1" };
const SECRET = "test-secret-abcdefghijklmnopqrstuvwxyz-0123456789";

function ctx(overrides: Partial<ConversionContext> = {}): ConversionContext {
  return {
    orderId: "order-1",
    sourcePublicKey: SOURCE,
    amountUsdc: "3.75",
    routeType: "usdc_wallet",
    status: "completed",
    hasActiveXlmMethod: true,
    alreadyConverted: false,
    pendingConversion: null,
    ...overrides,
  };
}

function fakeStore(overrides: Partial<ConversionStore> = {}): ConversionStore {
  return {
    getSellerProfileIdForUser: vi.fn(async () => SELLER),
    loadConversionContext: vi.fn(async () => ctx()),
    recordXlmConversion: vi.fn(async () => {}),
    failStaleConversion: vi.fn(async () => {}),
    ...overrides,
  };
}

function fakeGateway(overrides: Partial<PathPaymentGateway> = {}): PathPaymentGateway {
  return {
    prepareUsdcToXlmConversion: vi.fn(async () => ({
      sendUsdc: "3.75",
      estimatedXlm: "40.1234567",
      destMinXlm: "39.7222221",
      unsignedXdr: "UNSIGNED_XDR",
    })),
    submitPathPayment: vi.fn(async () => ({
      hash: "txhash123",
      ledger: 100,
      receivedXlm: "40.0000001",
    })),
    transactionSource: vi.fn(() => SOURCE),
    transactionHash: vi.fn(() => "txhash123"),
    getTransactionStatus: vi.fn(async () => "not_found" as const),
    ...overrides,
  };
}

function deps(
  store: ConversionStore,
  gateway: PathPaymentGateway,
  secret: string | undefined = SECRET,
): ConversionDeps {
  return { store, gateway, config: { networkName: "testnet", walletChallengeSecret: secret } };
}

describe("prepareXlmConversion", () => {
  it("returns an unsigned tx + binding token for an eligible direct payout", async () => {
    const d = deps(fakeStore(), fakeGateway());
    const res = await prepareXlmConversion(d, actor, PAYOUT);
    expect(res.unsignedXdr).toBe("UNSIGNED_XDR");
    expect(res.sourcePublicKey).toBe(SOURCE);
    expect(res.convertToken).toContain(".");
  });

  it("fails closed without the challenge secret", async () => {
    const d: ConversionDeps = {
      store: fakeStore(),
      gateway: fakeGateway(),
      config: { networkName: "testnet", walletChallengeSecret: undefined },
    };
    await expect(prepareXlmConversion(d, actor, PAYOUT)).rejects.toMatchObject({
      code: "WalletChallengeUnavailable",
    });
  });

  it("rejects a non-direct / not-completed payout", async () => {
    const store = fakeStore({
      loadConversionContext: vi.fn(async () => ctx({ status: "processing" })),
    });
    await expect(
      prepareXlmConversion(deps(store, fakeGateway()), actor, PAYOUT),
    ).rejects.toMatchObject({ code: "OrderNotEligible" });
  });

  it("requires an active XLM method", async () => {
    const store = fakeStore({
      loadConversionContext: vi.fn(async () => ctx({ hasActiveXlmMethod: false })),
    });
    await expect(
      prepareXlmConversion(deps(store, fakeGateway()), actor, PAYOUT),
    ).rejects.toMatchObject({ code: "Conflict" });
  });

  it("resolves a pending conversion that landed: confirms it and reports Conflict", async () => {
    const store = fakeStore({
      loadConversionContext: vi.fn(async () =>
        ctx({
          pendingConversion: {
            txHash: "pending-tx",
            sendUsdc: "3.75",
            recvXlm: "40",
            createdAt: new Date().toISOString(),
          },
        }),
      ),
    });
    const gateway = fakeGateway({
      getTransactionStatus: vi.fn(async () => "confirmed" as const),
    });
    await expect(
      prepareXlmConversion(deps(store, gateway), actor, PAYOUT),
    ).rejects.toMatchObject({ code: "Conflict" });
    expect(store.recordXlmConversion).toHaveBeenCalledWith(
      expect.objectContaining({ txHash: "pending-tx", status: "confirmed" }),
    );
  });

  it("fails over an expired pending conversion and prepares fresh", async () => {
    const store = fakeStore({
      loadConversionContext: vi.fn(async () =>
        ctx({
          pendingConversion: {
            txHash: "dead-tx",
            sendUsdc: "3.75",
            recvXlm: "40",
            createdAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
          },
        }),
      ),
    });
    const gateway = fakeGateway(); // getTransactionStatus -> not_found
    const res = await prepareXlmConversion(deps(store, gateway), actor, PAYOUT);
    expect(res.unsignedXdr).toBe("UNSIGNED_XDR");
    expect(store.failStaleConversion).toHaveBeenCalledWith({
      sourcePayoutId: PAYOUT,
      txHash: "dead-tx",
    });
  });

  it("blocks prepare while a recent pending conversion is still in flight", async () => {
    const store = fakeStore({
      loadConversionContext: vi.fn(async () =>
        ctx({
          pendingConversion: {
            txHash: "inflight-tx",
            sendUsdc: "3.75",
            recvXlm: "40",
            createdAt: new Date().toISOString(),
          },
        }),
      ),
    });
    await expect(
      prepareXlmConversion(deps(store, fakeGateway()), actor, PAYOUT),
    ).rejects.toMatchObject({ code: "Conflict" });
    expect(store.failStaleConversion).not.toHaveBeenCalled();
  });

  it("rejects a payout already converted", async () => {
    const store = fakeStore({
      loadConversionContext: vi.fn(async () => ctx({ alreadyConverted: true })),
    });
    await expect(
      prepareXlmConversion(deps(store, fakeGateway()), actor, PAYOUT),
    ).rejects.toMatchObject({ code: "Conflict" });
  });
});

describe("submitXlmConversion", () => {
  async function prepared() {
    const store = fakeStore();
    const gateway = fakeGateway();
    const d = deps(store, gateway);
    const p = await prepareXlmConversion(d, actor, PAYOUT);
    return { store, gateway, d, p };
  }

  it("records SUBMITTED before Horizon, then confirms with chain-actual XLM", async () => {
    const { store, d, p } = await prepared();
    const res = await submitXlmConversion(d, actor, {
      payoutId: PAYOUT,
      signedXdr: "SIGNED_XDR",
      convertToken: p.convertToken,
      sourcePublicKey: p.sourcePublicKey,
      sendUsdc: p.sendUsdc,
      estimatedXlm: p.estimatedXlm,
    });
    expect(res.txHash).toBe("txhash123");
    const calls = (store.recordXlmConversion as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls[0]![0]).toMatchObject({
      sourcePayoutId: PAYOUT,
      txHash: "txhash123",
      status: "submitted",
    });
    // Confirmed with the on-chain received amount, not the estimate.
    expect(calls[1]![0]).toMatchObject({
      status: "confirmed",
      recvXlm: "40.0000001",
    });
  });

  it("leaves the pending record and rejects when Horizon errors and the tx has not landed", async () => {
    const store = fakeStore();
    const gateway = fakeGateway({
      submitPathPayment: vi.fn(async () => {
        throw new Error("horizon timeout");
      }),
    });
    const d = deps(store, gateway);
    const p = await prepareXlmConversion(d, actor, PAYOUT);
    await expect(
      submitXlmConversion(d, actor, {
        payoutId: PAYOUT,
        signedXdr: "SIGNED_XDR",
        convertToken: p.convertToken,
        sourcePublicKey: p.sourcePublicKey,
        sendUsdc: p.sendUsdc,
        estimatedXlm: p.estimatedXlm,
      }),
    ).rejects.toMatchObject({ code: "SubmitRejected" });
    // submitted recorded once; never confirmed, never failed (may still land)
    const calls = (store.recordXlmConversion as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toMatchObject({ status: "submitted" });
    expect(store.failStaleConversion).not.toHaveBeenCalled();
  });

  it("confirms instead of failing when Horizon errors but the tx landed", async () => {
    const store = fakeStore();
    const gateway = fakeGateway({
      submitPathPayment: vi.fn(async () => {
        throw new Error("horizon 504");
      }),
      getTransactionStatus: vi.fn(async () => "confirmed" as const),
    });
    const d = deps(store, gateway);
    const p = await prepareXlmConversion(d, actor, PAYOUT);
    const res = await submitXlmConversion(d, actor, {
      payoutId: PAYOUT,
      signedXdr: "SIGNED_XDR",
      convertToken: p.convertToken,
      sourcePublicKey: p.sourcePublicKey,
      sendUsdc: p.sendUsdc,
      estimatedXlm: p.estimatedXlm,
    });
    expect(res.txHash).toBe("txhash123");
    const calls = (store.recordXlmConversion as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls[1]![0]).toMatchObject({ status: "confirmed" });
  });

  it("blocks submit while a DIFFERENT conversion tx is pending", async () => {
    const store = fakeStore();
    const gateway = fakeGateway();
    const d = deps(store, gateway);
    const p = await prepareXlmConversion(d, actor, PAYOUT);
    (store.loadConversionContext as ReturnType<typeof vi.fn>).mockResolvedValue(
      ctx({
        pendingConversion: {
          txHash: "other-tx",
          sendUsdc: "3.75",
          recvXlm: "40",
          createdAt: new Date().toISOString(),
        },
      }),
    );
    await expect(
      submitXlmConversion(d, actor, {
        payoutId: PAYOUT,
        signedXdr: "SIGNED_XDR",
        convertToken: p.convertToken,
        sourcePublicKey: p.sourcePublicKey,
        sendUsdc: p.sendUsdc,
        estimatedXlm: p.estimatedXlm,
      }),
    ).rejects.toMatchObject({ code: "Conflict" });
    expect(gateway.submitPathPayment).not.toHaveBeenCalled();
  });

  it("rejects a tampered token", async () => {
    const { d, p } = await prepared();
    await expect(
      submitXlmConversion(d, actor, {
        payoutId: PAYOUT,
        signedXdr: "SIGNED_XDR",
        convertToken: p.convertToken,
        sourcePublicKey: p.sourcePublicKey,
        sendUsdc: "999.0", // amount not in the token
        estimatedXlm: p.estimatedXlm,
      }),
    ).rejects.toMatchObject({ code: "Forbidden" });
  });

  it("rejects when the signed tx source is not the payout wallet", async () => {
    const store = fakeStore();
    const gateway = fakeGateway({ transactionSource: vi.fn(() => "G" + "B".repeat(55)) });
    const d = deps(store, gateway);
    const p = await prepareXlmConversion(d, actor, PAYOUT);
    await expect(
      submitXlmConversion(d, actor, {
        payoutId: PAYOUT,
        signedXdr: "SIGNED_XDR",
        convertToken: p.convertToken,
        sourcePublicKey: p.sourcePublicKey,
        sendUsdc: p.sendUsdc,
        estimatedXlm: p.estimatedXlm,
      }),
    ).rejects.toMatchObject({ code: "WrongBuyer" });
    expect(gateway.submitPathPayment).not.toHaveBeenCalled();
  });
});
