import type {
  CreateOrderGatewayResult,
  EscrowGateway,
  GatewayOrderView,
} from "@trustip/stellar";
import { describe, expect, it, vi } from "vitest";
import { PaymentError } from "../src/errors.js";
import { usdcToUnits } from "../src/money.js";
import {
  createRefundRequest,
  listRefundRequests,
  type RefundDeps,
  type RefundRequestRecord,
  type RefundResolutionContext,
  type RefundStore,
  resolveRefundRequest,
} from "../src/refund.js";
import type { ReleaseContext } from "../src/release.js";
import type { PaymentActor } from "../src/service.js";

const TESTNET = "Test SDF Network ; September 2015";
const SLUG = "cool-shirt";
const ORDER_NO = "TRP-TESTORDER0000001";
const REFUND_HASH = "d".repeat(64);
const BUYER = "G" + "B".repeat(55);
const CONTRACT_ORDER_ID = "ab".repeat(32);
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";

const ADMIN: PaymentActor = { userId: "admin-1", isAdmin: true };
const NON_ADMIN: PaymentActor = { userId: "user-1", isAdmin: false };

function baseContext(overrides: Partial<ReleaseContext> = {}): ReleaseContext {
  return {
    orderId: "order-1",
    orderNo: ORDER_NO,
    orderStatus: "shipped",
    paymentStatus: "confirmed",
    shipmentStatus: "shipped",
    escrow: {
      id: "escrow-1",
      status: "funded",
      contractOrderId: CONTRACT_ORDER_ID,
      buyerPublicKey: BUYER,
      sellerPublicKey: "G" + "S".repeat(55),
      amountUsdc: "10.5",
      releaseTxHash: null,
    },
    hasOpenRefundRequest: false,
    ...overrides,
  };
}

function createdRecord(): RefundRequestRecord {
  return {
    id: REQUEST_ID,
    orderId: "order-1",
    orderNo: ORDER_NO,
    status: "submitted",
    decision: "none",
    reasonCode: "not_received",
    description: null,
    requestedAmountUsdc: "10.5",
    createdAt: "2026-07-15T00:00:00Z",
    resolvedAt: null,
  };
}

function resolutionContext(
  overrides: Partial<RefundResolutionContext> = {},
): RefundResolutionContext {
  return {
    refund: { id: REQUEST_ID, status: "submitted", decision: "none" },
    orderId: "order-1",
    orderNo: ORDER_NO,
    orderStatus: "shipped",
    escrow: {
      id: "escrow-1",
      status: "funded",
      contractOrderId: CONTRACT_ORDER_ID,
      buyerPublicKey: BUYER,
      amountUsdc: "10.5",
      refundTxHash: null,
    },
    ...overrides,
  };
}

function fakeStore(
  ctx: ReleaseContext | null,
  overrides: Partial<RefundStore> = {},
): RefundStore {
  return {
    loadReleaseContext: vi.fn(async () => ctx),
    createRefundRequest: vi.fn(async () => createdRecord()),
    listAdminRefunds: vi.fn(async () => []),
    loadRefundResolutionContext: vi.fn(async () => resolutionContext()),
    markRefundRejected: vi.fn(async () => ({ applied: true })),
    markRefundApproved: vi.fn(async () => ({ applied: true })),
    recordRefundSubmitted: vi.fn(async () => {}),
    findRefundTxHash: vi.fn(async () => null),
    confirmRefunded: vi.fn(async () => ({ applied: true })),
    ...overrides,
  };
}

function fundedView(
  overrides: Partial<GatewayOrderView> = {},
): GatewayOrderView {
  return {
    status: "Funded",
    amount: usdcToUnits("10.5"),
    buyer: BUYER,
    seller: "G" + "S".repeat(55),
    payoutRecipient: "G" + "S".repeat(55),
    ...overrides,
  };
}

function fakeGateway(overrides: Partial<EscrowGateway> = {}): EscrowGateway {
  // First read (pre-refund guard) shows Funded; the post-refund re-read shows
  // Refunded.
  const readOrder = vi
    .fn(async (): Promise<GatewayOrderView | null> =>
      fundedView({ status: "Refunded" }),
    )
    .mockImplementationOnce(async () => fundedView());
  return {
    networkPassphrase: TESTNET,
    contractId: "C".repeat(56),
    readOrder,
    createOrder: vi.fn(),
    releaseOrder: vi.fn(),
    refundOrder: vi.fn(async (): Promise<CreateOrderGatewayResult> => ({
      hash: REFUND_HASH,
      status: "PENDING",
      sourceAccount: "GOPERATOR",
    })),
    buildFundOrderXdr: vi.fn(),
    parseFundTx: vi.fn(),
    submit: vi.fn(),
    getTransactionResult: vi.fn(async () => ({
      status: "SUCCESS" as const,
      ledger: 42,
    })),
    ...overrides,
  };
}

function deps(
  store: RefundStore,
  gateway: EscrowGateway = fakeGateway(),
): RefundDeps {
  return { store, gateway, config: { networkName: "testnet" } };
}

async function expectCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await promise.then(
    () => {
      throw new Error(`expected PaymentError(${code}) but the call succeeded`);
    },
    (e: unknown) => {
      expect(e).toBeInstanceOf(PaymentError);
      expect((e as PaymentError).code).toBe(code);
    },
  );
}

const REQUEST = {
  slug: SLUG,
  orderNo: ORDER_NO,
  reasonCode: "not_received" as const,
};

describe("createRefundRequest", () => {
  it("creates a request for a funded, non-terminal order", async () => {
    const store = fakeStore(baseContext());
    const res = await createRefundRequest(deps(store), {
      ...REQUEST,
      description: "  never arrived  ",
    });
    expect(res.id).toBe(REQUEST_ID);
    expect(store.createRefundRequest).toHaveBeenCalledWith({
      orderId: "order-1",
      reasonCode: "not_received",
      description: "never arrived",
    });
  });

  it("404s an unknown order", async () => {
    await expectCode(
      createRefundRequest(deps(fakeStore(null)), REQUEST),
      "CheckoutNotFound",
    );
  });

  it("409s when a refund is already open", async () => {
    const store = fakeStore(baseContext({ hasOpenRefundRequest: true }));
    await expectCode(createRefundRequest(deps(store), REQUEST), "Conflict");
  });

  it("404s when nothing is escrowed (payment not confirmed / not funded)", async () => {
    await expectCode(
      createRefundRequest(
        deps(fakeStore(baseContext({ paymentStatus: "submitted" }))),
        REQUEST,
      ),
      "CheckoutNotFound",
    );
    const releasedEscrow = baseContext();
    releasedEscrow.escrow!.status = "released";
    await expectCode(
      createRefundRequest(deps(fakeStore(releasedEscrow)), REQUEST),
      "CheckoutNotFound",
    );
  });

  it("404s terminal orders", async () => {
    for (const status of ["completed", "refunded", "cancelled", "failed"]) {
      await expectCode(
        createRefundRequest(
          deps(fakeStore(baseContext({ orderStatus: status }))),
          REQUEST,
        ),
        "CheckoutNotFound",
      );
    }
  });
});

describe("admin authorization", () => {
  it("rejects non-admins and anonymous callers", async () => {
    const d = deps(fakeStore(baseContext()));
    await expectCode(listRefundRequests(d, NON_ADMIN), "Forbidden");
    await expectCode(listRefundRequests(d, { userId: null }), "Forbidden");
    await expectCode(
      resolveRefundRequest(d, NON_ADMIN, {
        refundRequestId: REQUEST_ID,
        action: "approve",
      }),
      "Forbidden",
    );
  });
});

describe("resolveRefundRequest — reject", () => {
  it("marks rejected and records the admin action", async () => {
    const store = fakeStore(baseContext());
    const res = await resolveRefundRequest(deps(store), ADMIN, {
      refundRequestId: REQUEST_ID,
      action: "reject",
      note: "no evidence",
    });
    expect(res.status).toBe("rejected");
    expect(res.refundTxHash).toBeNull();
    expect(store.markRefundRejected).toHaveBeenCalledWith({
      refundRequestId: REQUEST_ID,
      adminUserId: "admin-1",
      note: "no evidence",
    });
  });

  it("409s a request that is not open", async () => {
    const store = fakeStore(baseContext(), {
      loadRefundResolutionContext: vi.fn(async () =>
        resolutionContext({
          refund: { id: REQUEST_ID, status: "rejected", decision: "release_seller" },
        }),
      ),
    });
    await expectCode(
      resolveRefundRequest(deps(store), ADMIN, {
        refundRequestId: REQUEST_ID,
        action: "reject",
      }),
      "Conflict",
    );
  });
});

describe("resolveRefundRequest — approve", () => {
  it("refunds on-chain, then records the refund atomically", async () => {
    const store = fakeStore(baseContext());
    const gateway = fakeGateway();
    const res = await resolveRefundRequest(deps(store, gateway), ADMIN, {
      refundRequestId: REQUEST_ID,
      action: "approve",
    });
    expect(res.status).toBe("completed");
    expect(res.refundTxHash).toBe(REFUND_HASH);
    // Decision recorded BEFORE money moved.
    expect(store.markRefundApproved).toHaveBeenCalled();
    expect(store.recordRefundSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({ txHash: REFUND_HASH }),
    );
    expect(store.confirmRefunded).toHaveBeenCalledWith(
      expect.objectContaining({
        refundRequestId: REQUEST_ID,
        txHash: REFUND_HASH,
        toPublicKey: BUYER,
      }),
    );
  });

  it("404s an unknown refund request", async () => {
    const store = fakeStore(baseContext(), {
      loadRefundResolutionContext: vi.fn(async () => null),
    });
    await expectCode(
      resolveRefundRequest(deps(store), ADMIN, {
        refundRequestId: REQUEST_ID,
        action: "approve",
      }),
      "OrderNotFound",
    );
  });

  it("409s when the on-chain amount mismatches", async () => {
    const gateway = fakeGateway({
      readOrder: vi.fn(async () => fundedView({ amount: usdcToUnits("9.0") })),
    });
    await expectCode(
      resolveRefundRequest(deps(fakeStore(baseContext()), gateway), ADMIN, {
        refundRequestId: REQUEST_ID,
        action: "approve",
      }),
      "AmountMismatch",
    );
  });

  it("409s when the chain is not refundable (already Released)", async () => {
    const gateway = fakeGateway({
      readOrder: vi.fn(async () => fundedView({ status: "Released" })),
    });
    await expectCode(
      resolveRefundRequest(deps(fakeStore(baseContext()), gateway), ADMIN, {
        refundRequestId: REQUEST_ID,
        action: "approve",
      }),
      "Conflict",
    );
  });

  it("does not double-submit when the chain is already Refunded (heal path)", async () => {
    const store = fakeStore(baseContext(), {
      loadRefundResolutionContext: vi.fn(async () =>
        resolutionContext({
          refund: { id: REQUEST_ID, status: "approved", decision: "none" },
        }),
      ),
      findRefundTxHash: vi.fn(async () => REFUND_HASH),
    });
    const gateway = fakeGateway({
      readOrder: vi.fn(async () => fundedView({ status: "Refunded" })),
    });
    const res = await resolveRefundRequest(deps(store, gateway), ADMIN, {
      refundRequestId: REQUEST_ID,
      action: "approve",
    });
    expect(res.status).toBe("completed");
    expect(res.refundTxHash).toBe(REFUND_HASH);
    expect(gateway.refundOrder).not.toHaveBeenCalled();
    // The approved state is a legal re-entry — no second approval write.
    expect(store.markRefundApproved).not.toHaveBeenCalled();
    expect(store.confirmRefunded).toHaveBeenCalled();
  });

  it("fails when the refund tx lands but the chain does not read Refunded", async () => {
    const gateway = fakeGateway();
    (gateway.readOrder as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockImplementationOnce(async () => fundedView())
      .mockImplementation(async () => fundedView({ status: "Funded" }));
    await expectCode(
      resolveRefundRequest(deps(fakeStore(baseContext()), gateway), ADMIN, {
        refundRequestId: REQUEST_ID,
        action: "approve",
      }),
      "Conflict",
    );
  });
});
