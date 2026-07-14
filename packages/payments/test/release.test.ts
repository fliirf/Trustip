import { Keypair, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import type {
  CreateOrderGatewayResult,
  EscrowGateway,
  GatewayOrderView,
} from "@trustip/stellar";
import { OperatorSignerError } from "@trustip/stellar";
import { describe, expect, it, vi } from "vitest";
import { PaymentError } from "../src/errors.js";
import { usdcToUnits } from "../src/money.js";
import {
  confirmOrderReceivedAndRelease,
  createConfirmReceivedToken,
  issueConfirmReceivedChallenge,
  type ReleaseContext,
  type ReleaseDeps,
  type ReleaseStore,
  verifyConfirmReceivedToken,
} from "../src/release.js";

const TESTNET = "Test SDF Network ; September 2015";
const SECRET = "release-test-secret";
const SLUG = "cool-shirt";
const ORDER_NO = "TRP-TESTORDER0000001";
const RELEASE_HASH = "c".repeat(64);

const buyerKp = Keypair.random();
const sellerKp = Keypair.random();
const BUYER = buyerKp.publicKey();
const SELLER = sellerKp.publicKey();
const CONTRACT_ORDER_ID = "ab".repeat(32);

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
      sellerPublicKey: SELLER,
      amountUsdc: "10.5",
      releaseTxHash: null,
    },
    hasOpenRefundRequest: false,
    ...overrides,
  };
}

function fakeStore(
  ctx: ReleaseContext | null,
  overrides: Partial<ReleaseStore> = {},
): ReleaseStore {
  return {
    loadReleaseContext: vi.fn(async () => ctx),
    markOrderDelivered: vi.fn(async () => ({ applied: true })),
    recordReleaseSubmitted: vi.fn(async () => {}),
    findReleaseTxHash: vi.fn(async () => null),
    confirmReleased: vi.fn(async () => ({ applied: true })),
    recomputeTrustProfile: vi.fn(async () => {}),
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
    seller: SELLER,
    payoutRecipient: SELLER,
    ...overrides,
  };
}

function fakeGateway(overrides: Partial<EscrowGateway> = {}): EscrowGateway {
  // First read (pre-release guard) shows Funded; the post-release re-read
  // shows Released.
  const readOrder = vi
    .fn(async (): Promise<GatewayOrderView | null> =>
      fundedView({ status: "Released" }),
    )
    .mockImplementationOnce(async () => fundedView());
  return {
    networkPassphrase: TESTNET,
    contractId: "C".repeat(56),
    readOrder,
    createOrder: vi.fn(),
    releaseOrder: vi.fn(async (): Promise<CreateOrderGatewayResult> => ({
      hash: RELEASE_HASH,
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
  store: ReleaseStore,
  gateway: EscrowGateway = fakeGateway(),
  secret: string | null = SECRET, // null = unset (fail closed)
): ReleaseDeps {
  return {
    store,
    gateway,
    config: {
      networkPassphrase: TESTNET,
      networkName: "testnet",
      walletChallengeSecret: secret ?? undefined,
    },
  };
}

/** Issue a real challenge and sign it with `signer` (default: the buyer). */
async function signedProof(
  d: ReleaseDeps,
  signer: Keypair = buyerKp,
): Promise<{ signedChallengeXdr: string; challengeToken: string }> {
  const challenge = await issueConfirmReceivedChallenge(d, {
    slug: SLUG,
    orderNo: ORDER_NO,
    networkPassphrase: TESTNET,
  });
  const tx = TransactionBuilder.fromXDR(
    challenge.challengeXdr,
    TESTNET,
  ) as Transaction;
  tx.sign(signer);
  return {
    signedChallengeXdr: tx.toXDR(),
    challengeToken: challenge.challengeToken,
  };
}

function confirmInput(proof: {
  signedChallengeXdr: string;
  challengeToken: string;
}) {
  return {
    slug: SLUG,
    orderNo: ORDER_NO,
    networkPassphrase: TESTNET,
    ...proof,
  };
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

describe("confirm-received token", () => {
  const claims = {
    slug: SLUG,
    orderNo: ORDER_NO,
    buyerPublicKey: BUYER,
    networkPassphrase: TESTNET,
  };

  it("round-trips and binds every claim", () => {
    const token = createConfirmReceivedToken(SECRET, claims, "nonce1", 1000);
    expect(verifyConfirmReceivedToken(SECRET, token, claims, 2000)).toBe(
      "nonce1",
    );
    expect(
      verifyConfirmReceivedToken(
        SECRET,
        token,
        { ...claims, buyerPublicKey: SELLER },
        2000,
      ),
    ).toBeNull();
    expect(
      verifyConfirmReceivedToken(
        SECRET,
        token,
        { ...claims, orderNo: "TRP-OTHER" },
        2000,
      ),
    ).toBeNull();
    expect(verifyConfirmReceivedToken("wrong", token, claims, 2000)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createConfirmReceivedToken(SECRET, claims, "n", 1000, 100);
    expect(verifyConfirmReceivedToken(SECRET, token, claims, 2000)).toBeNull();
  });
});

describe("issueConfirmReceivedChallenge", () => {
  it("issues a signable challenge for an eligible shipped order", async () => {
    const d = deps(fakeStore(baseContext()));
    const res = await issueConfirmReceivedChallenge(d, {
      slug: SLUG,
      orderNo: ORDER_NO,
      networkPassphrase: TESTNET,
    });
    expect(res.buyerPublicKey).toBe(BUYER);
    expect(res.challengeXdr).toBeTruthy();
    expect(res.challengeToken.split(".")).toHaveLength(3);
  });

  it("returns a generic 404 for a missing order", async () => {
    await expectCode(
      issueConfirmReceivedChallenge(deps(fakeStore(null)), {
        slug: SLUG,
        orderNo: ORDER_NO,
        networkPassphrase: TESTNET,
      }),
      "CheckoutNotFound",
    );
  });

  it("returns the same generic 404 for a not-yet-shipped order", async () => {
    const d = deps(fakeStore(baseContext({ orderStatus: "processing" })));
    await expectCode(
      issueConfirmReceivedChallenge(d, {
        slug: SLUG,
        orderNo: ORDER_NO,
        networkPassphrase: TESTNET,
      }),
      "CheckoutNotFound",
    );
  });

  it("fails closed when the challenge secret is not configured", async () => {
    const d = deps(fakeStore(baseContext()), fakeGateway(), null);
    await expectCode(
      issueConfirmReceivedChallenge(d, {
        slug: SLUG,
        orderNo: ORDER_NO,
        networkPassphrase: TESTNET,
      }),
      "WalletChallengeUnavailable",
    );
  });

  it("rejects a wrong network", async () => {
    await expectCode(
      issueConfirmReceivedChallenge(deps(fakeStore(baseContext())), {
        slug: SLUG,
        orderNo: ORDER_NO,
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      }),
      "WrongNetwork",
    );
  });
});

describe("confirmOrderReceivedAndRelease", () => {
  it("happy path: shipped + funded + buyer signature → delivered → released → completed", async () => {
    const store = fakeStore(baseContext());
    const gateway = fakeGateway();
    const d = deps(store, gateway);
    const res = await confirmOrderReceivedAndRelease(
      d,
      confirmInput(await signedProof(d)),
    );
    expect(res).toEqual({
      orderNo: ORDER_NO,
      orderStatus: "completed",
      escrowStatus: "released",
      releaseTxHash: RELEASE_HASH,
    });
    expect(store.markOrderDelivered).toHaveBeenCalledTimes(1);
    expect(gateway.releaseOrder).toHaveBeenCalledTimes(1);
    expect(store.recordReleaseSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({ txHash: RELEASE_HASH }),
    );
    expect(store.confirmReleased).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        escrowId: "escrow-1",
        txHash: RELEASE_HASH,
        ledger: 42,
      }),
    );
  });

  it("rejects a signature from a random (wrong) wallet", async () => {
    const store = fakeStore(baseContext());
    const d = deps(store);
    await expectCode(
      confirmOrderReceivedAndRelease(
        d,
        confirmInput(await signedProof(d, Keypair.random())),
      ),
      "WrongBuyer",
    );
    expect(store.markOrderDelivered).not.toHaveBeenCalled();
  });

  it("rejects a signature from the SELLER wallet", async () => {
    const store = fakeStore(baseContext());
    const gateway = fakeGateway();
    const d = deps(store, gateway);
    await expectCode(
      confirmOrderReceivedAndRelease(
        d,
        confirmInput(await signedProof(d, sellerKp)),
      ),
      "WrongBuyer",
    );
    expect(gateway.releaseOrder).not.toHaveBeenCalled();
  });

  it("rejects possession of the status URL without any valid proof", async () => {
    const d = deps(fakeStore(baseContext()));
    await expectCode(
      confirmOrderReceivedAndRelease(d, {
        slug: SLUG,
        orderNo: ORDER_NO,
        networkPassphrase: TESTNET,
        signedChallengeXdr: "AAAA",
        challengeToken: "not.a.token",
      }),
      "Forbidden",
    );
  });

  it("rejects an unsigned (structurally valid) challenge", async () => {
    const d = deps(fakeStore(baseContext()));
    const challenge = await issueConfirmReceivedChallenge(d, {
      slug: SLUG,
      orderNo: ORDER_NO,
      networkPassphrase: TESTNET,
    });
    await expectCode(
      confirmOrderReceivedAndRelease(d, {
        slug: SLUG,
        orderNo: ORDER_NO,
        networkPassphrase: TESTNET,
        signedChallengeXdr: challenge.challengeXdr, // never signed
        challengeToken: challenge.challengeToken,
      }),
      "WrongBuyer",
    );
  });

  it("rejects when the order is not shipped, even with a valid buyer proof", async () => {
    // Sign against an eligible context, then run against a not-shipped one
    // (challenge issuance itself refuses non-shipped orders).
    const proof = await signedProof(deps(fakeStore(baseContext())));
    const store = fakeStore(baseContext({ orderStatus: "packed" }));
    const gateway = fakeGateway();
    await expectCode(
      confirmOrderReceivedAndRelease(deps(store, gateway), confirmInput(proof)),
      "Conflict",
    );
    expect(gateway.releaseOrder).not.toHaveBeenCalled();
  });

  it("rejects when the order is shipped but the shipment row is not", async () => {
    const store = fakeStore(baseContext({ shipmentStatus: "packed" }));
    const d = deps(store);
    await expectCode(
      confirmOrderReceivedAndRelease(d, confirmInput(await signedProof(d))),
      "Conflict",
    );
    expect(store.markOrderDelivered).not.toHaveBeenCalled();
  });

  it("rejects when the payment is not confirmed", async () => {
    const ctx = baseContext({ paymentStatus: "submitted" });
    const store = fakeStore(ctx);
    const d = deps(store);
    // Challenge issuance refuses unconfirmed payments; sign against an
    // eligible context, then flip the store to the unconfirmed one.
    const eligible = deps(fakeStore(baseContext()));
    const proof = await signedProof(eligible);
    await expectCode(
      confirmOrderReceivedAndRelease(d, confirmInput(proof)),
      "Conflict",
    );
  });

  it("rejects when the DB escrow is not funded", async () => {
    const ctx = baseContext();
    ctx.escrow!.status = "created";
    const d = deps(fakeStore(ctx));
    await expectCode(
      confirmOrderReceivedAndRelease(d, confirmInput(await signedProof(d))),
      "Conflict",
    );
  });

  it("rejects when the on-chain order is not Funded", async () => {
    const gateway = fakeGateway({
      readOrder: vi.fn(async () => fundedView({ status: "Created" })),
    });
    const store = fakeStore(baseContext());
    const d = deps(store, gateway);
    await expectCode(
      confirmOrderReceivedAndRelease(d, confirmInput(await signedProof(d))),
      "Conflict",
    );
    expect(store.markOrderDelivered).not.toHaveBeenCalled();
  });

  it("rejects an on-chain amount mismatch", async () => {
    const gateway = fakeGateway({
      readOrder: vi.fn(async () => fundedView({ amount: usdcToUnits("11") })),
    });
    const d = deps(fakeStore(baseContext()), gateway);
    await expectCode(
      confirmOrderReceivedAndRelease(d, confirmInput(await signedProof(d))),
      "AmountMismatch",
    );
  });

  it("rejects an on-chain buyer mismatch", async () => {
    const gateway = fakeGateway({
      readOrder: vi.fn(async () =>
        fundedView({ buyer: Keypair.random().publicKey() }),
      ),
    });
    const d = deps(fakeStore(baseContext()), gateway);
    await expectCode(
      confirmOrderReceivedAndRelease(d, confirmInput(await signedProof(d))),
      "WrongBuyer",
    );
  });

  it("rejects a payout-recipient mismatch", async () => {
    const gateway = fakeGateway({
      readOrder: vi.fn(async () =>
        fundedView({ payoutRecipient: Keypair.random().publicKey() }),
      ),
    });
    const d = deps(fakeStore(baseContext()), gateway);
    await expectCode(
      confirmOrderReceivedAndRelease(d, confirmInput(await signedProof(d))),
      "ChainOrderMismatch",
    );
  });

  it("rejects when a refund request is open", async () => {
    const store = fakeStore(baseContext({ hasOpenRefundRequest: true }));
    const gateway = fakeGateway();
    const d = deps(store, gateway);
    await expectCode(
      confirmOrderReceivedAndRelease(d, confirmInput(await signedProof(d))),
      "Conflict",
    );
    expect(gateway.releaseOrder).not.toHaveBeenCalled();
  });

  it("maps a missing operator signer and never records a release", async () => {
    const store = fakeStore(baseContext());
    const gateway = fakeGateway({
      releaseOrder: vi.fn(async () => {
        throw new OperatorSignerError(
          "AdminSignerMissing",
          "operator/admin signer secret is not configured",
        );
      }),
    });
    const d = deps(store, gateway);
    await expectCode(
      confirmOrderReceivedAndRelease(d, confirmInput(await signedProof(d))),
      "AdminSignerMissing",
    );
    expect(store.confirmReleased).not.toHaveBeenCalled();
    // delivered stands (buyer action) and stays retryable
    expect(store.markOrderDelivered).toHaveBeenCalledTimes(1);
  });

  it("submit rejection leaves delivered but never released/completed", async () => {
    const store = fakeStore(baseContext());
    const gateway = fakeGateway({
      releaseOrder: vi.fn(async (): Promise<CreateOrderGatewayResult> => ({
        hash: RELEASE_HASH,
        status: "ERROR",
        sourceAccount: "GOPERATOR",
      })),
    });
    const d = deps(store, gateway);
    await expectCode(
      confirmOrderReceivedAndRelease(d, confirmInput(await signedProof(d))),
      "SubmitRejected",
    );
    expect(store.markOrderDelivered).toHaveBeenCalledTimes(1);
    expect(store.confirmReleased).not.toHaveBeenCalled();
  });

  it("on-chain FAILED release never records released", async () => {
    const store = fakeStore(baseContext());
    const gateway = fakeGateway({
      getTransactionResult: vi.fn(async () => ({ status: "FAILED" as const })),
    });
    const d = deps(store, gateway);
    await expectCode(
      confirmOrderReceivedAndRelease(d, confirmInput(await signedProof(d))),
      "SubmitRejected",
    );
    expect(store.confirmReleased).not.toHaveBeenCalled();
  });

  it("heals: chain Released + DB lagging (delivered) converges via the RPC", async () => {
    const ctx = baseContext({ orderStatus: "delivered" });
    const store = fakeStore(ctx, {
      findReleaseTxHash: vi.fn(async () => RELEASE_HASH),
    });
    const gateway = fakeGateway({
      readOrder: vi.fn(async () => fundedView({ status: "Released" })),
    });
    const d = deps(store, gateway);
    const res = await confirmOrderReceivedAndRelease(
      d,
      confirmInput(await signedProof(d)),
    );
    expect(res.releaseTxHash).toBe(RELEASE_HASH);
    expect(gateway.releaseOrder).not.toHaveBeenCalled();
    expect(store.markOrderDelivered).not.toHaveBeenCalled();
    expect(store.confirmReleased).toHaveBeenCalledWith(
      expect.objectContaining({ txHash: RELEASE_HASH }),
    );
  });

  it("chain Released with NO recoverable tx hash fails closed", async () => {
    const ctx = baseContext({ orderStatus: "delivered" });
    const store = fakeStore(ctx);
    const gateway = fakeGateway({
      readOrder: vi.fn(async () => fundedView({ status: "Released" })),
    });
    const d = deps(store, gateway);
    await expectCode(
      confirmOrderReceivedAndRelease(d, confirmInput(await signedProof(d))),
      "Conflict",
    );
    expect(store.confirmReleased).not.toHaveBeenCalled();
  });

  it("is idempotent: already released + completed returns success without chain calls", async () => {
    const ctx = baseContext({ orderStatus: "completed" });
    ctx.escrow!.status = "released";
    ctx.escrow!.releaseTxHash = RELEASE_HASH;
    const store = fakeStore(ctx);
    const gateway = fakeGateway();
    const d = deps(store, gateway);
    // Sign against an eligible context (issuance refuses completed orders);
    // the token claims are identical.
    const proof = await signedProof(deps(fakeStore(baseContext())));
    const res = await confirmOrderReceivedAndRelease(d, confirmInput(proof));
    expect(res.releaseTxHash).toBe(RELEASE_HASH);
    expect(gateway.readOrder).not.toHaveBeenCalled();
    expect(gateway.releaseOrder).not.toHaveBeenCalled();
    expect(store.confirmReleased).not.toHaveBeenCalled();
  });

  it("concurrent confirm: losing the delivered transition is a clean Conflict", async () => {
    const store = fakeStore(baseContext(), {
      markOrderDelivered: vi.fn(async () => ({ applied: false })),
    });
    const gateway = fakeGateway();
    const d = deps(store, gateway);
    await expectCode(
      confirmOrderReceivedAndRelease(d, confirmInput(await signedProof(d))),
      "Conflict",
    );
    expect(gateway.releaseOrder).not.toHaveBeenCalled();
    expect(store.confirmReleased).not.toHaveBeenCalled();
  });

  it("fails closed when the challenge secret is unset", async () => {
    const d = deps(fakeStore(baseContext()), fakeGateway(), null);
    await expectCode(
      confirmOrderReceivedAndRelease(d, {
        slug: SLUG,
        orderNo: ORDER_NO,
        networkPassphrase: TESTNET,
        signedChallengeXdr: "AAAA",
        challengeToken: "x.y.z",
      }),
      "WalletChallengeUnavailable",
    );
  });
});
