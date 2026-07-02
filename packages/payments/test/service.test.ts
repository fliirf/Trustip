import {
  type CreateOrderGatewayInput,
  type CreateOrderGatewayResult,
  type EscrowGateway,
  type GatewayOrderView,
  OperatorSignerError,
  type ParsedFundTx,
  type SubmitResult as GatewaySubmitResult,
  type TxResult,
} from "@trustip/stellar";
import { describe, expect, it, vi } from "vitest";
import { createAttemptToken } from "../src/attempt-token.js";
import { PaymentError, type PaymentErrorCode } from "../src/errors.js";
import { usdcToUnits } from "../src/money.js";
import type {
  EscrowRecord,
  OrderRecord,
  PaymentContext,
  PaymentRecord,
  PaymentStore,
} from "../src/ports.js";
import {
  ensureOnChainEscrowOrderCreated,
  getPaymentStatus,
  type PaymentConfig,
  type PaymentDeps,
  preparePayment,
  submitPayment,
  syncPayment,
} from "../src/service.js";

const TESTNET = "Test SDF Network ; September 2015";
const MAINNET = "Public Global Stellar Network ; September 2015";
const CONTRACT_ID = "CDJO4D3R34KGLXHTD6ZVGERKOIKM66JVICY6RJABWWL2CXII7PCTBD3L";
const OTHER_CONTRACT =
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const BUYER = "GDD4RGXYIEDKCA7YSCBOLUOUCWKKDBNOYFEHZZ5H3QVT7YWDQDLKRGA7";
const OTHER_BUYER = "GAYLGJXBBND7YLIWQLVYXY6ZFRJLBFFWUCIJS6CJL3SIPAYEYUBRFBCJ";
const SELLER = "GDROYCO5IZUTNIW3KYXY6A4NI7LR33RPVPB757KCUVT4NFTESKOCFBT7";
const HASH = "deadbeef".repeat(8); // 64 hex chars
const ORDER_HEX = "a".repeat(64); // escrow.contractOrderId in prepared fixtures
const CREATE_HASH = "cafe".repeat(16); // 64 hex chars (create_order tx hash)
// Stand-in operator/admin source key for create_order in fakes (value is never
// asserted; reuses a valid strkey).
const OPERATOR = SELLER;

const CONFIG: PaymentConfig = {
  networkPassphrase: TESTNET,
  networkName: "testnet",
  escrowContractId: CONTRACT_ID,
};

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

// --- in-memory PaymentStore -------------------------------------------------

interface FakeInit {
  order?: Partial<OrderRecord>;
  payment?: PaymentRecord | null;
  escrow?: EscrowRecord | null;
  buyerWalletPublicKey?: string | null;
  sellerWalletPublicKey?: string | null;
}

function createFakeStore(init: FakeInit = {}) {
  const state = {
    order: {
      id: "order-1",
      status: "awaiting_payment",
      totalUsdc: "10.5",
      buyerUserId: null,
      sellerProfileId: "seller-1",
      buyerWalletId: null,
      sellerWalletId: null,
      ...init.order,
    } as OrderRecord,
    payment: init.payment ?? null,
    escrow: init.escrow ?? null,
    buyerWalletPublicKey: init.buyerWalletPublicKey ?? null,
    sellerWalletPublicKey: init.sellerWalletPublicKey ?? null,
    txHashIndex: new Map<string, PaymentRecord>(),
    calls: { submission: 0, confirmed: 0, failure: 0, creationTx: 0 },
  };

  const context = (): PaymentContext => ({
    order: state.order,
    payment: state.payment,
    escrow: state.escrow,
    buyerWalletPublicKey: state.buyerWalletPublicKey,
    sellerWalletPublicKey: state.sellerWalletPublicKey,
  });

  const store: PaymentStore = {
    async loadByOrderId(orderId) {
      return orderId === state.order.id ? context() : null;
    },
    async loadByPaymentId(paymentId) {
      return state.payment && state.payment.id === paymentId ? context() : null;
    },
    async preparePaymentRow(input) {
      if (
        state.payment &&
        (state.payment.status === "submitted" ||
          state.payment.status === "confirmed")
      ) {
        return state.payment;
      }
      state.payment = {
        id: state.payment?.id ?? "pay-1",
        orderId: input.orderId,
        status: "awaiting_signature",
        amountUsdc: input.amountUsdc,
        network: input.network,
        payerPublicKey: input.payerPublicKey,
        txHash: null,
        ledger: null,
        confirmedAt: null,
      };
      return state.payment;
    },
    async linkEscrowRow(input) {
      state.escrow = {
        id: state.escrow?.id ?? "esc-1",
        orderId: input.orderId,
        status: input.onChainStatus,
        contractId: input.contractId,
        contractOrderId: input.contractOrderId,
        amountUsdc: input.amountUsdc,
        buyerPublicKey: input.buyerPublicKey,
        sellerPublicKey: input.sellerPublicKey,
        fundedTxHash: null,
      };
      return state.escrow;
    },
    async findPaymentByTxHash(txHash) {
      if (state.txHashIndex.has(txHash)) return state.txHashIndex.get(txHash)!;
      if (state.payment && state.payment.txHash === txHash)
        return state.payment;
      return null;
    },
    async recordSubmission(input) {
      state.calls.submission += 1;
      if (state.payment) {
        state.payment = {
          ...state.payment,
          status: "submitted",
          txHash: input.txHash,
        };
      }
      if (state.order.status === "awaiting_payment") {
        state.order = { ...state.order, status: "payment_submitted" };
      }
    },
    async recordFundConfirmed(input) {
      // Mirrors the atomic RPC: guarded, idempotent. `applied` reflects the
      // payment newly confirming; escrow/order are healed regardless.
      state.calls.confirmed += 1;
      const wasConfirmed = state.payment?.status === "confirmed";
      if (state.payment && !wasConfirmed) {
        state.payment = {
          ...state.payment,
          status: "confirmed",
          ledger: input.ledger,
          confirmedAt: "2026-07-02T00:00:00Z",
        };
      }
      if (state.escrow && state.escrow.status !== "funded") {
        state.escrow = {
          ...state.escrow,
          status: "funded",
          fundedTxHash: input.txHash,
        };
      }
      if (state.order.status !== "escrow_locked") {
        state.order = { ...state.order, status: "escrow_locked" };
      }
      return { applied: !wasConfirmed };
    },
    async recordEscrowCreationTx(input) {
      state.calls.creationTx += 1;
      void input;
    },
    async recordFailure(input) {
      state.calls.failure += 1;
      if (state.payment && state.payment.status !== "confirmed") {
        state.payment = { ...state.payment, status: "failed" };
      }
      void input;
    },
  };

  return { store, state };
}

function createFakeGateway(
  overrides: Partial<EscrowGateway> = {},
): EscrowGateway {
  const created: GatewayOrderView = {
    status: "Created",
    amount: usdcToUnits("10.5"),
    buyer: BUYER,
    seller: SELLER,
  };
  const parsed: ParsedFundTx = {
    hash: HASH,
    source: BUYER,
    invokesContract: true,
    contractId: CONTRACT_ID,
    functionName: "fund_order",
    contractOrderId: ORDER_HEX,
    buyer: BUYER,
    amountUnits: usdcToUnits("10.5"),
  };
  return {
    networkPassphrase: TESTNET,
    contractId: CONTRACT_ID,
    readOrder: vi.fn(async () => created),
    buildFundOrderXdr: vi.fn(async () => "UNSIGNED_XDR"),
    parseFundTx: vi.fn(() => parsed),
    submit: vi.fn(async (): Promise<GatewaySubmitResult> => ({
      hash: HASH,
      status: "PENDING",
    })),
    getTransactionResult: vi.fn(async (): Promise<TxResult> => ({
      status: "SUCCESS",
      ledger: 123,
    })),
    createOrder: vi.fn(async (): Promise<CreateOrderGatewayResult> => ({
      hash: CREATE_HASH,
      status: "PENDING",
      sourceAccount: OPERATOR,
    })),
    ...overrides,
  };
}

function deps(
  store: PaymentStore,
  gateway: EscrowGateway = createFakeGateway(),
  config: PaymentConfig = CONFIG,
): PaymentDeps {
  return { store, gateway, config };
}

// --- prepare ----------------------------------------------------------------

describe("preparePayment", () => {
  it("returns unsigned XDR and links payment + escrow for a payable order", async () => {
    const { store, state } = createFakeStore();
    const res = await preparePayment(deps(store), {
      orderId: "order-1",
      buyerPublicKey: BUYER,
      networkPassphrase: TESTNET,
    });

    expect(res.unsignedXdr).toBe("UNSIGNED_XDR");
    expect(res.paymentId).toBe("pay-1");
    expect(res.expectedAmount).toBe("10.5");
    expect(res.expectedAmountUnits).toBe("105000000");
    expect(res.networkPassphrase).toBe(TESTNET);
    expect(res.contractOrderId).toMatch(/^[0-9a-f]{64}$/);
    expect(res.attemptToken).toBeUndefined(); // no secret configured
    expect(state.payment?.status).toBe("awaiting_signature");
    expect(state.escrow?.status).toBe("created");
  });

  it("issues an attempt token when a secret is configured", async () => {
    const { store } = createFakeStore();
    const res = await preparePayment(
      deps(store, createFakeGateway(), { ...CONFIG, attemptSecret: "s" }),
      { orderId: "order-1", buyerPublicKey: BUYER, networkPassphrase: TESTNET },
    );
    expect(typeof res.attemptToken).toBe("string");
    expect(res.attemptToken!.length).toBeGreaterThan(0);
  });

  it("rejects a missing network (fail closed)", async () => {
    const { store } = createFakeStore();
    await rejectsWith(
      () =>
        preparePayment(deps(store), {
          orderId: "order-1",
          buyerPublicKey: BUYER,
          networkPassphrase: "",
        }),
      "InvalidInput",
    );
  });

  it("rejects wrong network before any work", async () => {
    const { store } = createFakeStore();
    await rejectsWith(
      () =>
        preparePayment(deps(store), {
          orderId: "order-1",
          buyerPublicKey: BUYER,
          networkPassphrase: MAINNET,
        }),
      "WrongNetwork",
    );
  });

  it("rejects an invalid buyer public key", async () => {
    const { store } = createFakeStore();
    await rejectsWith(
      () =>
        preparePayment(deps(store), {
          orderId: "order-1",
          buyerPublicKey: "not-a-key",
          networkPassphrase: TESTNET,
        }),
      "InvalidInput",
    );
  });

  it("rejects a missing order", async () => {
    const { store } = createFakeStore();
    await rejectsWith(
      () =>
        preparePayment(deps(store), {
          orderId: "does-not-exist",
          buyerPublicKey: BUYER,
          networkPassphrase: TESTNET,
        }),
      "OrderNotFound",
    );
  });

  it("rejects an order that is not awaiting payment", async () => {
    const { store } = createFakeStore({ order: { status: "shipped" } });
    await rejectsWith(
      () =>
        preparePayment(deps(store), {
          orderId: "order-1",
          buyerPublicKey: BUYER,
          networkPassphrase: TESTNET,
        }),
      "OrderNotPayable",
    );
  });

  it("rejects when the buyer does not match a bound order wallet", async () => {
    const { store } = createFakeStore({ buyerWalletPublicKey: OTHER_BUYER });
    await rejectsWith(
      () =>
        preparePayment(deps(store), {
          orderId: "order-1",
          buyerPublicKey: BUYER,
          networkPassphrase: TESTNET,
        }),
      "WrongBuyer",
    );
  });

  it("rejects when the on-chain order is not created yet", async () => {
    const { store } = createFakeStore();
    const gateway = createFakeGateway({ readOrder: vi.fn(async () => null) });
    await rejectsWith(
      () =>
        preparePayment(deps(store, gateway), {
          orderId: "order-1",
          buyerPublicKey: BUYER,
          networkPassphrase: TESTNET,
        }),
      "EscrowNotReady",
    );
  });

  it("rejects an on-chain amount mismatch", async () => {
    const { store } = createFakeStore();
    const gateway = createFakeGateway({
      readOrder: vi.fn(async () => ({
        status: "Created",
        amount: usdcToUnits("9"),
        buyer: BUYER,
        seller: SELLER,
      })),
    });
    await rejectsWith(
      () =>
        preparePayment(deps(store, gateway), {
          orderId: "order-1",
          buyerPublicKey: BUYER,
          networkPassphrase: TESTNET,
        }),
      "AmountMismatch",
    );
  });

  it("rejects an on-chain buyer mismatch", async () => {
    const { store } = createFakeStore();
    const gateway = createFakeGateway({
      readOrder: vi.fn(async () => ({
        status: "Created",
        amount: usdcToUnits("10.5"),
        buyer: OTHER_BUYER,
        seller: SELLER,
      })),
    });
    await rejectsWith(
      () =>
        preparePayment(deps(store, gateway), {
          orderId: "order-1",
          buyerPublicKey: BUYER,
          networkPassphrase: TESTNET,
        }),
      "WrongBuyer",
    );
  });

  it("rejects when the on-chain order is already funded", async () => {
    const { store } = createFakeStore();
    const gateway = createFakeGateway({
      readOrder: vi.fn(async () => ({
        status: "Funded",
        amount: usdcToUnits("10.5"),
        buyer: BUYER,
        seller: SELLER,
      })),
    });
    await rejectsWith(
      () =>
        preparePayment(deps(store, gateway), {
          orderId: "order-1",
          buyerPublicKey: BUYER,
          networkPassphrase: TESTNET,
        }),
      "EscrowAlreadyFunded",
    );
  });
});

// --- submit -----------------------------------------------------------------

function preparedStore() {
  return createFakeStore({
    payment: {
      id: "pay-1",
      orderId: "order-1",
      status: "awaiting_signature",
      amountUsdc: "10.5",
      network: "testnet",
      payerPublicKey: BUYER,
      txHash: null,
      ledger: null,
      confirmedAt: null,
    },
    escrow: {
      id: "esc-1",
      orderId: "order-1",
      status: "created",
      contractId: CONTRACT_ID,
      contractOrderId: ORDER_HEX,
      amountUsdc: "10.5",
      buyerPublicKey: BUYER,
      sellerPublicKey: SELLER,
      fundedTxHash: null,
    },
    order: { status: "payment_submitted" },
  });
}

function submitInput(overrides: Record<string, unknown> = {}) {
  return {
    paymentId: "pay-1",
    signedXdr: "SIGNED",
    networkPassphrase: TESTNET,
    ...overrides,
  };
}

describe("submitPayment", () => {
  it("submits and marks the payment submitted (not confirmed)", async () => {
    const { store, state } = preparedStore();
    state.order = { ...state.order, status: "awaiting_payment" };
    const res = await submitPayment(deps(store), submitInput());
    expect(res.status).toBe("submitted");
    expect(res.txHash).toBe(HASH);
    expect(res.alreadyProcessed).toBe(false);
    expect(state.payment?.status).toBe("submitted");
    expect(state.payment?.txHash).toBe(HASH);
    expect(state.order.status).toBe("payment_submitted");
    expect(state.calls.submission).toBe(1);
  });

  it("treats a DUPLICATE send as submitted", async () => {
    const { store, state } = preparedStore();
    const gateway = createFakeGateway({
      submit: vi.fn(async () => ({ hash: HASH, status: "DUPLICATE" as const })),
    });
    const res = await submitPayment(deps(store, gateway), submitInput());
    expect(res.status).toBe("submitted");
    expect(state.payment?.status).toBe("submitted");
  });

  it("records a failure and rejects on ERROR (never marks paid)", async () => {
    const { store, state } = preparedStore();
    const gateway = createFakeGateway({
      submit: vi.fn(async () => ({
        hash: HASH,
        status: "ERROR" as const,
        errorResult: "tx_failed",
      })),
    });
    await rejectsWith(
      () => submitPayment(deps(store, gateway), submitInput()),
      "SubmitRejected",
    );
    expect(state.payment?.status).toBe("failed");
    expect(state.calls.failure).toBe(1);
  });

  it("does not change state on a transient TRY_AGAIN_LATER", async () => {
    const { store, state } = preparedStore();
    const gateway = createFakeGateway({
      submit: vi.fn(async () => ({
        hash: HASH,
        status: "TRY_AGAIN_LATER" as const,
      })),
    });
    await rejectsWith(
      () => submitPayment(deps(store, gateway), submitInput()),
      "RpcFailure",
    );
    expect(state.payment?.status).toBe("awaiting_signature");
    expect(state.calls.failure).toBe(0);
  });

  // ---- HIGH-1 fail-closed binding ------------------------------------------

  it("accepts a correctly bound fund_order tx", async () => {
    const { store, state } = preparedStore();
    const res = await submitPayment(deps(store), submitInput());
    expect(res.status).toBe("submitted");
    expect(state.payment?.txHash).toBe(HASH);
  });

  it("rejects a tx that funds a different contract_order_id", async () => {
    const { store } = preparedStore();
    const gateway = createFakeGateway({
      parseFundTx: vi.fn(() => ({
        hash: HASH,
        source: BUYER,
        invokesContract: true,
        contractId: CONTRACT_ID,
        functionName: "fund_order",
        contractOrderId: "b".repeat(64),
        buyer: BUYER,
        amountUnits: usdcToUnits("10.5"),
      })),
    });
    await rejectsWith(
      () => submitPayment(deps(store, gateway), submitInput()),
      "InvalidSignedTx",
    );
  });

  it("rejects when the contract id cannot be parsed (fail closed)", async () => {
    const { store } = preparedStore();
    const gateway = createFakeGateway({
      parseFundTx: vi.fn(() => ({
        hash: HASH,
        source: BUYER,
        invokesContract: true,
        contractId: undefined,
        functionName: "fund_order",
        contractOrderId: ORDER_HEX,
        buyer: BUYER,
        amountUnits: usdcToUnits("10.5"),
      })),
    });
    await rejectsWith(
      () => submitPayment(deps(store, gateway), submitInput()),
      "InvalidSignedTx",
    );
  });

  it("rejects a tx targeting a different contract", async () => {
    const { store } = preparedStore();
    const gateway = createFakeGateway({
      parseFundTx: vi.fn(() => ({
        hash: HASH,
        source: BUYER,
        invokesContract: true,
        contractId: OTHER_CONTRACT,
        functionName: "fund_order",
        contractOrderId: ORDER_HEX,
        buyer: BUYER,
        amountUnits: usdcToUnits("10.5"),
      })),
    });
    await rejectsWith(
      () => submitPayment(deps(store, gateway), submitInput()),
      "InvalidSignedTx",
    );
  });

  it("rejects a tx invoking the wrong function", async () => {
    const { store } = preparedStore();
    const gateway = createFakeGateway({
      parseFundTx: vi.fn(() => ({
        hash: HASH,
        source: BUYER,
        invokesContract: true,
        contractId: CONTRACT_ID,
        functionName: "release_to_recipient",
        contractOrderId: ORDER_HEX,
        buyer: BUYER,
        amountUnits: usdcToUnits("10.5"),
      })),
    });
    await rejectsWith(
      () => submitPayment(deps(store, gateway), submitInput()),
      "InvalidSignedTx",
    );
  });

  it("rejects a tx whose source is not the buyer", async () => {
    const { store } = preparedStore();
    const gateway = createFakeGateway({
      parseFundTx: vi.fn(() => ({
        hash: HASH,
        source: OTHER_BUYER,
        invokesContract: true,
        contractId: CONTRACT_ID,
        functionName: "fund_order",
        contractOrderId: ORDER_HEX,
        buyer: BUYER,
        amountUnits: usdcToUnits("10.5"),
      })),
    });
    await rejectsWith(
      () => submitPayment(deps(store, gateway), submitInput()),
      "InvalidSignedTx",
    );
  });

  it("rejects a tx with the wrong fund amount", async () => {
    const { store } = preparedStore();
    const gateway = createFakeGateway({
      parseFundTx: vi.fn(() => ({
        hash: HASH,
        source: BUYER,
        invokesContract: true,
        contractId: CONTRACT_ID,
        functionName: "fund_order",
        contractOrderId: ORDER_HEX,
        buyer: BUYER,
        amountUnits: usdcToUnits("9"),
      })),
    });
    await rejectsWith(
      () => submitPayment(deps(store, gateway), submitInput()),
      "AmountMismatch",
    );
  });

  it("rejects when the expected buyer is unknown (fail closed)", async () => {
    const { store, state } = preparedStore();
    state.payment = { ...state.payment!, payerPublicKey: null };
    state.escrow = { ...state.escrow!, buyerPublicKey: null };
    await rejectsWith(
      () => submitPayment(deps(store), submitInput()),
      "Conflict",
    );
  });

  it("rejects a tx that does not invoke a contract", async () => {
    const { store } = preparedStore();
    const gateway = createFakeGateway({
      parseFundTx: vi.fn(() => ({
        hash: HASH,
        source: BUYER,
        invokesContract: false,
      })),
    });
    await rejectsWith(
      () => submitPayment(deps(store, gateway), submitInput()),
      "InvalidSignedTx",
    );
  });

  it("rejects an unparseable signed tx", async () => {
    const { store } = preparedStore();
    const gateway = createFakeGateway({
      parseFundTx: vi.fn(() => {
        throw new Error("bad xdr");
      }),
    });
    await rejectsWith(
      () => submitPayment(deps(store, gateway), submitInput()),
      "InvalidSignedTx",
    );
  });

  it("rejects a tx hash already used by another payment", async () => {
    const { store, state } = preparedStore();
    state.txHashIndex.set(HASH, {
      id: "other-pay",
      orderId: "order-2",
      status: "submitted",
      amountUsdc: "10.5",
      network: "testnet",
      payerPublicKey: BUYER,
      txHash: HASH,
      ledger: null,
      confirmedAt: null,
    });
    const submit = vi.fn();
    const gateway = createFakeGateway({ submit });
    await rejectsWith(
      () => submitPayment(deps(store, gateway), submitInput()),
      "DuplicateTx",
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it("is idempotent when already submitted (no resubmit)", async () => {
    const { store, state } = preparedStore();
    state.payment = { ...state.payment!, status: "submitted", txHash: "xyz" };
    const submit = vi.fn();
    const parse = vi.fn();
    const gateway = createFakeGateway({ submit, parseFundTx: parse });
    const res = await submitPayment(deps(store, gateway), submitInput());
    expect(res.alreadyProcessed).toBe(true);
    expect(res.status).toBe("submitted");
    expect(res.txHash).toBe("xyz");
    expect(submit).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
  });

  it("rejects a missing network", async () => {
    const { store } = preparedStore();
    await rejectsWith(
      () => submitPayment(deps(store), submitInput({ networkPassphrase: "" })),
      "InvalidInput",
    );
  });

  it("rejects wrong network", async () => {
    const { store } = preparedStore();
    await rejectsWith(
      () =>
        submitPayment(deps(store), submitInput({ networkPassphrase: MAINNET })),
      "WrongNetwork",
    );
  });

  it("rejects a missing payment", async () => {
    const { store } = createFakeStore();
    await rejectsWith(
      () => submitPayment(deps(store), submitInput({ paymentId: "nope" })),
      "PaymentNotFound",
    );
  });

  // ---- MEDIUM-2 attempt token ----------------------------------------------

  it("rejects submit without a valid token when a secret is configured", async () => {
    const { store } = preparedStore();
    await rejectsWith(
      () =>
        submitPayment(
          deps(store, createFakeGateway(), {
            ...CONFIG,
            attemptSecret: "s",
          }),
          submitInput(),
        ),
      "Forbidden",
    );
  });

  it("accepts submit with a valid prepare token", async () => {
    const { store, state } = preparedStore();
    const token = createAttemptToken("s", {
      paymentId: "pay-1",
      contractOrderId: ORDER_HEX,
    });
    const res = await submitPayment(
      deps(store, createFakeGateway(), { ...CONFIG, attemptSecret: "s" }),
      submitInput({ attemptToken: token }),
    );
    expect(res.status).toBe("submitted");
    expect(state.payment?.status).toBe("submitted");
  });
});

// --- sync -------------------------------------------------------------------

function submittedStore() {
  const s = preparedStore();
  s.state.payment = { ...s.state.payment!, status: "submitted", txHash: HASH };
  return s;
}

// Gateway whose tx result is SUCCESS and whose on-chain order reads Funded with
// the matching amount — the only combination that confirms a payment.
function fundedGateway(): EscrowGateway {
  return createFakeGateway({
    getTransactionResult: vi.fn(async () => ({
      status: "SUCCESS" as const,
      ledger: 123,
    })),
    readOrder: vi.fn(async () => ({
      status: "Funded" as const,
      amount: usdcToUnits("10.5"),
      buyer: BUYER,
      seller: SELLER,
    })),
  });
}

describe("syncPayment", () => {
  it("confirms and funds escrow when the chain reports Funded", async () => {
    const { store, state } = submittedStore();
    const res = await syncPayment(deps(store, fundedGateway()), {
      paymentId: "pay-1",
    });
    expect(res.status).toBe("confirmed");
    expect(res.applied).toBe(true);
    expect(state.payment?.status).toBe("confirmed");
    expect(state.escrow?.status).toBe("funded");
    expect(state.order.status).toBe("escrow_locked");
    expect(state.calls.confirmed).toBe(1);
  });

  it("heals a partially-applied confirm on the next sync (no chain call)", async () => {
    // payment already confirmed, but escrow/order lagged (simulated crash).
    const { store, state } = submittedStore();
    state.payment = { ...state.payment!, status: "confirmed" };
    state.escrow = { ...state.escrow!, status: "created" };
    state.order = { ...state.order, status: "payment_submitted" };
    const getTx = vi.fn();
    const gateway = createFakeGateway({ getTransactionResult: getTx });
    const res = await syncPayment(deps(store, gateway), { paymentId: "pay-1" });
    expect(res.status).toBe("confirmed");
    expect(getTx).not.toHaveBeenCalled(); // no re-verification
    expect(state.escrow?.status).toBe("funded");
    expect(state.order.status).toBe("escrow_locked");
    expect(state.calls.confirmed).toBe(1);
  });

  it("is a no-op when already fully confirmed (double sync)", async () => {
    const { store, state } = submittedStore();
    const d = deps(store, fundedGateway());
    await syncPayment(d, { paymentId: "pay-1" });
    const second = await syncPayment(d, { paymentId: "pay-1" });
    expect(second.applied).toBe(false);
    expect(second.status).toBe("confirmed");
    expect(state.calls.confirmed).toBe(1);
  });

  it("marks failed (not paid) when the chain reports FAILED", async () => {
    const { store, state } = submittedStore();
    const gateway = createFakeGateway({
      getTransactionResult: vi.fn(async () => ({ status: "FAILED" as const })),
    });
    const res = await syncPayment(deps(store, gateway), { paymentId: "pay-1" });
    expect(res.status).toBe("failed");
    expect(state.payment?.status).toBe("failed");
    expect(state.escrow?.status).toBe("created");
    expect(state.order.status).not.toBe("escrow_locked");
    expect(state.calls.confirmed).toBe(0);
  });

  it("stays pending when the tx is not yet found", async () => {
    const { store, state } = submittedStore();
    const gateway = createFakeGateway({
      getTransactionResult: vi.fn(async () => ({
        status: "NOT_FOUND" as const,
      })),
    });
    const res = await syncPayment(deps(store, gateway), { paymentId: "pay-1" });
    expect(res.pending).toBe(true);
    expect(res.status).toBe("submitted");
    expect(state.payment?.status).toBe("submitted");
  });

  it("does nothing when no tx has been submitted", async () => {
    const { store } = preparedStore(); // awaiting_signature, no txHash
    const getTx = vi.fn();
    const gateway = createFakeGateway({ getTransactionResult: getTx });
    const res = await syncPayment(deps(store, gateway), { paymentId: "pay-1" });
    expect(res.pending).toBe(true);
    expect(res.txHash).toBeNull();
    expect(getTx).not.toHaveBeenCalled();
  });

  it("does not confirm when a succeeded tx's on-chain order is not Funded", async () => {
    const { store, state } = submittedStore();
    const gateway = createFakeGateway({
      readOrder: vi.fn(async () => ({
        status: "Created" as const,
        amount: usdcToUnits("10.5"),
        buyer: BUYER,
        seller: SELLER,
      })),
    });
    await rejectsWith(
      () => syncPayment(deps(store, gateway), { paymentId: "pay-1" }),
      "Conflict",
    );
    expect(state.payment?.status).toBe("submitted");
  });

  it("rejects an on-chain amount mismatch on confirmation", async () => {
    const { store } = submittedStore();
    const gateway = createFakeGateway({
      readOrder: vi.fn(async () => ({
        status: "Funded" as const,
        amount: usdcToUnits("9"),
        buyer: BUYER,
        seller: SELLER,
      })),
    });
    await rejectsWith(
      () => syncPayment(deps(store, gateway), { paymentId: "pay-1" }),
      "AmountMismatch",
    );
  });
});

// --- status -----------------------------------------------------------------

describe("getPaymentStatus", () => {
  it("allows an unauthenticated reader for a guest order", async () => {
    const { store } = submittedStore();
    const res = await getPaymentStatus(deps(store), {
      paymentId: "pay-1",
      actor: { userId: null },
    });
    expect(res.paymentId).toBe("pay-1");
    expect(res.orderId).toBe("order-1");
    expect(res.amountUsdc).toBe("10.5");
    expect(res.txHash).toBe(HASH);
  });

  it("allows the bound buyer and rejects a different user", async () => {
    const { store } = createFakeStore({
      order: { buyerUserId: "user-1" },
      payment: {
        id: "pay-1",
        orderId: "order-1",
        status: "confirmed",
        amountUsdc: "10.5",
        network: "testnet",
        payerPublicKey: BUYER,
        txHash: HASH,
        ledger: 1,
        confirmedAt: "2026-07-02T00:00:00Z",
      },
    });
    const ok = await getPaymentStatus(deps(store), {
      paymentId: "pay-1",
      actor: { userId: "user-1" },
    });
    expect(ok.paymentStatus).toBe("confirmed");

    await rejectsWith(
      () =>
        getPaymentStatus(deps(store), {
          paymentId: "pay-1",
          actor: { userId: "user-2" },
        }),
      "Forbidden",
    );
  });

  it("allows the order's seller and an admin on a bound order", async () => {
    const { store } = createFakeStore({
      order: { buyerUserId: "user-1", sellerProfileId: "seller-1" },
      payment: {
        id: "pay-1",
        orderId: "order-1",
        status: "submitted",
        amountUsdc: "10.5",
        network: "testnet",
        payerPublicKey: BUYER,
        txHash: HASH,
        ledger: null,
        confirmedAt: null,
      },
    });
    const asSeller = await getPaymentStatus(deps(store), {
      paymentId: "pay-1",
      actor: { userId: "seller-user", sellerProfileId: "seller-1" },
    });
    expect(asSeller.paymentStatus).toBe("submitted");

    const asAdmin = await getPaymentStatus(deps(store), {
      paymentId: "pay-1",
      actor: { userId: "admin-1", isAdmin: true },
    });
    expect(asAdmin.paymentStatus).toBe("submitted");
  });
});

// --- ensureOnChainEscrowOrderCreated (Phase 4.1) ----------------------------

describe("ensureOnChainEscrowOrderCreated", () => {
  function createStore(init: FakeInit = {}) {
    return createFakeStore({
      order: { status: "awaiting_payment", totalUsdc: "10.5" },
      sellerWalletPublicKey: SELLER,
      ...init,
    });
  }

  function ensureInput(overrides: Record<string, unknown> = {}) {
    return {
      orderId: "order-1",
      buyerPublicKey: BUYER,
      networkPassphrase: TESTNET,
      ...overrides,
    };
  }

  // Gateway whose on-chain order starts absent and becomes Created when
  // create_order is invoked (mirrors a real create landing on-chain).
  function creatingGateway(overrides: Partial<EscrowGateway> = {}) {
    let chain: GatewayOrderView | null = null;
    const createOrder = vi.fn(
      async (
        input: CreateOrderGatewayInput,
      ): Promise<CreateOrderGatewayResult> => {
        chain = {
          status: "Created",
          amount: input.amountUnits,
          buyer: input.buyerPublicKey,
          seller: input.sellerPublicKey,
        };
        return {
          hash: CREATE_HASH,
          status: "PENDING",
          sourceAccount: OPERATOR,
        };
      },
    );
    const gateway = createFakeGateway({
      readOrder: vi.fn(async () => chain),
      getTransactionResult: vi.fn(async () => ({
        status: "SUCCESS" as const,
        ledger: 55,
      })),
      createOrder,
      ...overrides,
    });
    return { gateway, createOrder };
  }

  it("creates the on-chain order and records escrow + create tx when none exists", async () => {
    const { store, state } = createStore();
    const { gateway, createOrder } = creatingGateway();
    const res = await ensureOnChainEscrowOrderCreated(
      deps(store, gateway),
      ensureInput(),
    );
    expect(res.alreadyExisted).toBe(false);
    expect(res.escrowStatus).toBe("created");
    expect(res.txHash).toBe(CREATE_HASH);
    expect(res.contractOrderId).toMatch(/^[0-9a-f]{64}$/);
    expect(createOrder).toHaveBeenCalledTimes(1);
    const arg = createOrder.mock.calls[0]![0];
    expect(arg.amountUnits).toBe(usdcToUnits("10.5"));
    expect(arg.buyerPublicKey).toBe(BUYER);
    expect(arg.sellerPublicKey).toBe(SELLER);
    expect(arg.payoutRecipient).toBe(SELLER);
    expect(state.escrow?.status).toBe("created");
    expect(state.escrow?.contractOrderId).toBe(res.contractOrderId);
    expect(state.calls.creationTx).toBe(1);
  });

  it("derives the create amount from the server order total, not the client", async () => {
    const { store } = createStore({ order: { totalUsdc: "42" } });
    const { gateway, createOrder } = creatingGateway();
    await ensureOnChainEscrowOrderCreated(deps(store, gateway), ensureInput());
    expect(createOrder.mock.calls[0]![0].amountUnits).toBe(usdcToUnits("42"));
  });

  it("is idempotent when the chain already has the order Created (no re-create)", async () => {
    const { store, state } = createStore();
    const createOrder = vi.fn();
    // Default fake readOrder returns a Created order for BUYER @ 10.5.
    const gateway = createFakeGateway({ createOrder });
    const res = await ensureOnChainEscrowOrderCreated(
      deps(store, gateway),
      ensureInput(),
    );
    expect(res.alreadyExisted).toBe(true);
    expect(res.escrowStatus).toBe("created");
    expect(createOrder).not.toHaveBeenCalled();
    expect(state.escrow?.status).toBe("created"); // reconciled into the DB
    expect(state.calls.creationTx).toBe(0); // no create tx recorded on reconcile
  });

  it("does not create a second on-chain order on duplicate calls", async () => {
    const { store } = createStore();
    const { gateway, createOrder } = creatingGateway();
    const d = deps(store, gateway);
    const first = await ensureOnChainEscrowOrderCreated(d, ensureInput());
    const second = await ensureOnChainEscrowOrderCreated(d, ensureInput());
    expect(first.alreadyExisted).toBe(false);
    expect(second.alreadyExisted).toBe(true);
    expect(createOrder).toHaveBeenCalledTimes(1);
  });

  it("reconciles a create_order race (OrderAlreadyExists) instead of failing", async () => {
    const { store, state } = createStore();
    let chain: GatewayOrderView | null = null;
    const createOrder = vi.fn(
      async (
        input: CreateOrderGatewayInput,
      ): Promise<CreateOrderGatewayResult> => {
        // A concurrent operator created it first; our submit is rejected.
        chain = {
          status: "Created",
          amount: input.amountUnits,
          buyer: input.buyerPublicKey,
          seller: input.sellerPublicKey,
        };
        return {
          hash: CREATE_HASH,
          status: "ERROR",
          errorResult: "OrderAlreadyExists",
          sourceAccount: OPERATOR,
        };
      },
    );
    const gateway = createFakeGateway({
      readOrder: vi.fn(async () => chain),
      createOrder,
    });
    const res = await ensureOnChainEscrowOrderCreated(
      deps(store, gateway),
      ensureInput(),
    );
    expect(res.alreadyExisted).toBe(true);
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(state.escrow?.status).toBe("created");
  });

  it("surfaces EscrowCreateFailed when create errors and no order exists", async () => {
    const { store } = createStore();
    const gateway = createFakeGateway({
      readOrder: vi.fn(async () => null),
      createOrder: vi.fn(async (): Promise<CreateOrderGatewayResult> => ({
        hash: CREATE_HASH,
        status: "ERROR",
        sourceAccount: OPERATOR,
      })),
    });
    await rejectsWith(
      () =>
        ensureOnChainEscrowOrderCreated(deps(store, gateway), ensureInput()),
      "EscrowCreateFailed",
    );
  });

  it("maps a missing admin signer to AdminSignerMissing", async () => {
    const { store } = createStore();
    const gateway = createFakeGateway({
      readOrder: vi.fn(async () => null),
      createOrder: vi.fn(async () => {
        throw new OperatorSignerError(
          "AdminSignerMissing",
          "operator secret not configured",
        );
      }),
    });
    await rejectsWith(
      () =>
        ensureOnChainEscrowOrderCreated(deps(store, gateway), ensureInput()),
      "AdminSignerMissing",
    );
  });

  it("maps a mainnet-disallowed signer to AdminSignerNotAllowedOnMainnet", async () => {
    const { store } = createStore();
    const gateway = createFakeGateway({
      readOrder: vi.fn(async () => null),
      createOrder: vi.fn(async () => {
        throw new OperatorSignerError(
          "AdminSignerNotAllowedOnMainnet",
          "disabled on mainnet",
        );
      }),
    });
    await rejectsWith(
      () =>
        ensureOnChainEscrowOrderCreated(deps(store, gateway), ensureInput()),
      "AdminSignerNotAllowedOnMainnet",
    );
  });

  it("rejects an invalid buyer public key", async () => {
    const { store } = createStore();
    await rejectsWith(
      () =>
        ensureOnChainEscrowOrderCreated(
          deps(store),
          ensureInput({ buyerPublicKey: "not-a-key" }),
        ),
      "InvalidBuyerPublicKey",
    );
  });

  it("rejects an empty buyer public key", async () => {
    const { store } = createStore();
    await rejectsWith(
      () =>
        ensureOnChainEscrowOrderCreated(
          deps(store),
          ensureInput({ buyerPublicKey: "" }),
        ),
      "InvalidBuyerPublicKey",
    );
  });

  it("rejects a missing network and a wrong network (fail closed)", async () => {
    const { store } = createStore();
    await rejectsWith(
      () =>
        ensureOnChainEscrowOrderCreated(
          deps(store),
          ensureInput({ networkPassphrase: "" }),
        ),
      "InvalidInput",
    );
    await rejectsWith(
      () =>
        ensureOnChainEscrowOrderCreated(
          deps(store),
          ensureInput({ networkPassphrase: MAINNET }),
        ),
      "WrongNetwork",
    );
  });

  it("rejects an order that is not awaiting payment", async () => {
    const { store } = createStore({ order: { status: "shipped" } });
    const gateway = creatingGateway().gateway; // chain starts null
    await rejectsWith(
      () =>
        ensureOnChainEscrowOrderCreated(deps(store, gateway), ensureInput()),
      "OrderNotEligible",
    );
  });

  it("rejects when the seller has no payout wallet", async () => {
    const { store } = createStore({ sellerWalletPublicKey: null });
    const gateway = creatingGateway().gateway;
    await rejectsWith(
      () =>
        ensureOnChainEscrowOrderCreated(deps(store, gateway), ensureInput()),
      "OrderNotEligible",
    );
  });

  it("rejects a buyer that does not match the order's bound wallet", async () => {
    const { store } = createStore({ buyerWalletPublicKey: OTHER_BUYER });
    const gateway = creatingGateway().gateway;
    await rejectsWith(
      () =>
        ensureOnChainEscrowOrderCreated(deps(store, gateway), ensureInput()),
      "WrongBuyer",
    );
  });

  it("rejects when the on-chain order is for a different buyer", async () => {
    const { store } = createStore();
    const gateway = createFakeGateway({
      readOrder: vi.fn(async () => ({
        status: "Created" as const,
        amount: usdcToUnits("10.5"),
        buyer: OTHER_BUYER,
        seller: SELLER,
      })),
      createOrder: vi.fn(),
    });
    await rejectsWith(
      () =>
        ensureOnChainEscrowOrderCreated(deps(store, gateway), ensureInput()),
      "WrongBuyer",
    );
  });

  it("rejects an on-chain amount mismatch", async () => {
    const { store } = createStore();
    const gateway = createFakeGateway({
      readOrder: vi.fn(async () => ({
        status: "Created" as const,
        amount: usdcToUnits("9"),
        buyer: BUYER,
        seller: SELLER,
      })),
      createOrder: vi.fn(),
    });
    await rejectsWith(
      () =>
        ensureOnChainEscrowOrderCreated(deps(store, gateway), ensureInput()),
      "ChainOrderMismatch",
    );
  });

  it("lets prepare proceed (no EscrowNotReady) after orchestration", async () => {
    const { store } = createStore();
    const { gateway } = creatingGateway();
    const d = deps(store, gateway);
    // Before orchestration the on-chain order is absent → prepare fails closed.
    await rejectsWith(
      () =>
        preparePayment(d, {
          orderId: "order-1",
          buyerPublicKey: BUYER,
          networkPassphrase: TESTNET,
        }),
      "EscrowNotReady",
    );
    // Orchestrate create_order, then prepare succeeds against the same order.
    await ensureOnChainEscrowOrderCreated(d, ensureInput());
    const prep = await preparePayment(d, {
      orderId: "order-1",
      buyerPublicKey: BUYER,
      networkPassphrase: TESTNET,
    });
    expect(prep.unsignedXdr).toBe("UNSIGNED_XDR");
    expect(prep.contractOrderId).toMatch(/^[0-9a-f]{64}$/);
  });
});
