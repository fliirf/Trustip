import { describe, expect, it } from "vitest";
import { PaymentError, type PaymentErrorCode } from "../src/errors.js";
import {
  SHIPMENT_TRANSITION_FROM,
  updateSellerShipment,
  type SellerDeps,
  type SellerProfileRecord,
  type SellerStore,
  type ShipmentOrderContext,
  type ShipmentSummary,
} from "../src/seller-onboarding.js";
import type { PaymentActor } from "../src/service.js";

// ---------------------------------------------------------------------------
// Phase 8A — seller shipment lifecycle. The service must enforce: ownership
// (profile-scoped lookup), funded-escrow precondition, strict single-step
// forward transitions, shipped-needs-tracking, and must be structurally unable
// to set payment/escrow/release state (applyShipmentUpdate's input type has no
// such fields — asserted below on the captured write).
// ---------------------------------------------------------------------------

const OWNER = "00000000-0000-4000-8000-00000000aaaa";
const OTHER = "00000000-0000-4000-8000-00000000bbbb";
const ORDER_NO = "TRP-SHIPTEST0000001";

const owner: PaymentActor = { userId: OWNER };
const stranger: PaymentActor = { userId: OTHER };

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

/** Minimal fake: one order owned by OWNER's profile. Captures every
 * applyShipmentUpdate call for assertions. */
function makeFixture(init: {
  orderStatus: string;
  escrowStatus?: string | null;
  applied?: boolean;
}) {
  const profileByUser = new Map<string, SellerProfileRecord>([
    [
      OWNER,
      {
        id: "profile-owner",
        userId: OWNER,
        storeName: "Toko Ship",
        category: null,
        socialUrl: null,
      },
    ],
    [
      OTHER,
      {
        id: "profile-other",
        userId: OTHER,
        storeName: "Toko Lain",
        category: null,
        socialUrl: null,
      },
    ],
  ]);
  const order: ShipmentOrderContext = {
    orderId: "order-ship-1",
    orderNo: ORDER_NO,
    status: init.orderStatus,
    escrowStatus:
      init.escrowStatus === undefined ? "funded" : init.escrowStatus,
  };
  const writes: Array<Record<string, unknown>> = [];

  const store = {
    async getSellerProfile(userId: string) {
      return profileByUser.get(userId) ?? null;
    },
    async getSellerOrderForShipment({
      sellerProfileId,
      orderNo,
    }: {
      sellerProfileId: string;
      orderNo: string;
    }) {
      // Ownership scoping exactly like the adapter WHERE clause.
      if (sellerProfileId !== "profile-owner" || orderNo !== ORDER_NO) {
        return null;
      }
      return order;
    },
    async applyShipmentUpdate(input: Record<string, unknown>) {
      writes.push(input);
      const shipment: ShipmentSummary = {
        status: input.toStatus as string,
        courier: (input.courier as string | null) ?? null,
        trackingNumber: (input.trackingNumber as string | null) ?? null,
        shippedAt: (input.shippedAt as string | null) ?? null,
      };
      return { applied: init.applied ?? true, shipment };
    },
  } as unknown as SellerStore;

  const deps: SellerDeps = {
    store,
    config: {
      networkName: "testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  };
  return { deps, writes };
}

describe("updateSellerShipment — allowed forward transitions", () => {
  it("owner moves escrow_locked → processing", async () => {
    const { deps, writes } = makeFixture({ orderStatus: "escrow_locked" });
    const result = await updateSellerShipment(deps, owner, {
      orderNo: ORDER_NO,
      status: "processing",
    });
    expect(result.orderNo).toBe(ORDER_NO);
    expect(result.orderStatus).toBe("processing");
    expect(result.shipment.status).toBe("processing");
    expect(result.shipment.shippedAt).toBeNull();
    expect(writes[0]).toMatchObject({
      fromStatus: "escrow_locked",
      toStatus: "processing",
      shippedAt: null,
      actorUserId: OWNER,
    });
  });

  it("owner moves processing → packed", async () => {
    const { deps } = makeFixture({ orderStatus: "processing" });
    const result = await updateSellerShipment(deps, owner, {
      orderNo: ORDER_NO,
      status: "packed",
    });
    expect(result.orderStatus).toBe("packed");
  });

  it("owner moves packed → shipped with courier + tracking, shippedAt server-set", async () => {
    const { deps, writes } = makeFixture({ orderStatus: "packed" });
    const now = Date.parse("2026-07-07T12:00:00Z");
    const result = await updateSellerShipment(
      deps,
      owner,
      {
        orderNo: ORDER_NO,
        status: "shipped",
        courier: "JNE",
        trackingNumber: "JNE-8821-TEST",
      },
      now,
    );
    expect(result.orderStatus).toBe("shipped");
    expect(result.shipment.courier).toBe("JNE");
    expect(result.shipment.trackingNumber).toBe("JNE-8821-TEST");
    expect(result.shipment.shippedAt).toBe("2026-07-07T12:00:00.000Z");
    expect(writes[0]).toMatchObject({
      fromStatus: "packed",
      toStatus: "shipped",
      shippedAt: "2026-07-07T12:00:00.000Z",
    });
  });
});

describe("updateSellerShipment — guards", () => {
  it("rejects before escrow is funded (order still awaiting payment)", async () => {
    const { deps, writes } = makeFixture({
      orderStatus: "awaiting_payment",
      escrowStatus: "created",
    });
    await rejectsWith(
      () =>
        updateSellerShipment(deps, owner, {
          orderNo: ORDER_NO,
          status: "processing",
        }),
      "Conflict",
    );
    expect(writes).toHaveLength(0);
  });

  it("rejects when escrow row is missing even if order status looks right", async () => {
    const { deps } = makeFixture({
      orderStatus: "escrow_locked",
      escrowStatus: null,
    });
    await rejectsWith(
      () =>
        updateSellerShipment(deps, owner, {
          orderNo: ORDER_NO,
          status: "processing",
        }),
      "Conflict",
    );
  });

  it("rejects a non-owner seller with a generic 404 (no oracle)", async () => {
    const { deps, writes } = makeFixture({ orderStatus: "escrow_locked" });
    await rejectsWith(
      () =>
        updateSellerShipment(deps, stranger, {
          orderNo: ORDER_NO,
          status: "processing",
        }),
      "OrderNotFound",
    );
    expect(writes).toHaveLength(0);
  });

  it("rejects an unauthenticated actor", async () => {
    const { deps } = makeFixture({ orderStatus: "escrow_locked" });
    await rejectsWith(
      () =>
        updateSellerShipment(
          deps,
          { userId: null },
          { orderNo: ORDER_NO, status: "processing" },
        ),
      "Forbidden",
    );
  });

  it("rejects a backward transition (shipped → processing)", async () => {
    const { deps } = makeFixture({ orderStatus: "shipped" });
    await rejectsWith(
      () =>
        updateSellerShipment(deps, owner, {
          orderNo: ORDER_NO,
          status: "processing",
        }),
      "Conflict",
    );
  });

  it("rejects skipping a step (escrow_locked → shipped)", async () => {
    const { deps } = makeFixture({ orderStatus: "escrow_locked" });
    await rejectsWith(
      () =>
        updateSellerShipment(deps, owner, {
          orderNo: ORDER_NO,
          status: "shipped",
          courier: "JNE",
          trackingNumber: "JNE-1",
        }),
      "Conflict",
    );
  });

  it("rejects mutation on refunded/cancelled/failed orders", async () => {
    for (const status of ["refunded", "cancelled", "failed"]) {
      const { deps } = makeFixture({ orderStatus: status });
      await rejectsWith(
        () =>
          updateSellerShipment(deps, owner, {
            orderNo: ORDER_NO,
            status: "processing",
          }),
        "Conflict",
      );
    }
  });

  it("rejects shipped without courier/trackingNumber", async () => {
    const { deps, writes } = makeFixture({ orderStatus: "packed" });
    await rejectsWith(
      () =>
        updateSellerShipment(deps, owner, {
          orderNo: ORDER_NO,
          status: "shipped",
        }),
      "InvalidInput",
    );
    expect(writes).toHaveLength(0);
  });

  it("maps a concurrent status change (applied=false) to Conflict", async () => {
    const { deps } = makeFixture({
      orderStatus: "escrow_locked",
      applied: false,
    });
    await rejectsWith(
      () =>
        updateSellerShipment(deps, owner, {
          orderNo: ORDER_NO,
          status: "processing",
        }),
      "Conflict",
    );
  });
});

describe("updateSellerShipment — payment/escrow state is out of reach", () => {
  it("the transition map only targets seller shipment states", () => {
    // Arbitrary/elevated statuses are impossible by type + by this map:
    // there is no path to paid/funded/released/completed/delivered.
    expect(Object.keys(SHIPMENT_TRANSITION_FROM).sort()).toEqual([
      "packed",
      "processing",
      "shipped",
    ]);
    expect(Object.values(SHIPMENT_TRANSITION_FROM)).not.toContain("completed");
  });

  it("the store write carries only shipment-safe fields", async () => {
    const { deps, writes } = makeFixture({ orderStatus: "escrow_locked" });
    await updateSellerShipment(deps, owner, {
      orderNo: ORDER_NO,
      status: "processing",
      note: "dikemas besok",
    });
    expect(Object.keys(writes[0]!).sort()).toEqual([
      "actorUserId",
      "courier",
      "fromStatus",
      "note",
      "orderId",
      "shippedAt",
      "toStatus",
      "trackingNumber",
    ]);
  });
});
