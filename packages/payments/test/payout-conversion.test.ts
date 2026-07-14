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
    ...overrides,
  };
}

function fakeStore(overrides: Partial<ConversionStore> = {}): ConversionStore {
  return {
    getSellerProfileIdForUser: vi.fn(async () => SELLER),
    loadConversionContext: vi.fn(async () => ctx()),
    recordXlmConversion: vi.fn(async () => {}),
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
    submitPathPayment: vi.fn(async () => ({ hash: "txhash123", ledger: 100 })),
    transactionSource: vi.fn(() => SOURCE),
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

  it("verifies the token, submits, and records the conversion", async () => {
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
    expect(store.recordXlmConversion).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePayoutId: PAYOUT,
        txHash: "txhash123",
        recvXlm: p.estimatedXlm,
      }),
    );
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
