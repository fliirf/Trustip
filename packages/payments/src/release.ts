import {
  buildWalletChallengeTx,
  type EscrowGateway,
  OperatorSignerError,
  verifyWalletChallengeTx,
} from "@trustip/stellar";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PaymentError } from "./errors.js";
import { usdcToUnits } from "./money.js";
import type { NetworkName } from "./ports.js";
import { generateChallengeNonce } from "./wallet-challenge-token.js";

// ---------------------------------------------------------------------------
// RELEASE-1 — buyer-confirmed escrow release.
//
// Possession of the public (slug, order_no) pair is NOT enough to release
// funds: the seller knows both values. Release additionally requires a
// signature from the exact wallet that funded the escrow (the buyer key frozen
// on the escrow row when the on-chain order was created/funded). The proof is
// the existing wallet-challenge mechanism (SEP-10-style manageData tx) bound
// by a short-lived, single-purpose HMAC token.
// ---------------------------------------------------------------------------

// --- Confirm-received challenge token ----------------------------------------
// Stateless HMAC token binding {slug, orderNo, buyerPublicKey, network} for the
// single purpose "confirm_received". Domain-separated from every other Trustip
// HMAC token. Format: `${exp}.${nonce}.${hmac}` (nonce travels in the token).

export const CONFIRM_RECEIVED_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface ConfirmReceivedClaims {
  slug: string;
  orderNo: string;
  buyerPublicKey: string;
  networkPassphrase: string;
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function payloadFor(
  claims: ConfirmReceivedClaims,
  nonce: string,
  exp: number,
): string {
  return [
    "confirm-received:v1",
    claims.slug,
    claims.orderNo,
    claims.buyerPublicKey,
    claims.networkPassphrase,
    nonce,
    exp,
  ].join(":");
}

export function createConfirmReceivedToken(
  secret: string,
  claims: ConfirmReceivedClaims,
  nonce: string,
  now: number = Date.now(),
  ttlMs: number = CONFIRM_RECEIVED_TOKEN_TTL_MS,
): string {
  const exp = now + ttlMs;
  return `${exp}.${nonce}.${sign(secret, payloadFor(claims, nonce, exp))}`;
}

/** Returns the bound nonce when valid; null for anything malformed / expired /
 * mismatched (never throws). Constant-time HMAC comparison. */
export function verifyConfirmReceivedToken(
  secret: string,
  token: string,
  claims: ConfirmReceivedClaims,
  now: number = Date.now(),
): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [expStr, nonce, sig] = parts as [string, string, string];
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now) return null;
  if (!nonce) return null;
  const expected = sign(secret, payloadFor(claims, nonce, exp));
  if (sig.length !== expected.length) return null;
  try {
    return timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(expected, "hex"),
    )
      ? nonce
      : null;
  } catch {
    return null;
  }
}

// --- Storage port -------------------------------------------------------------

/** Everything the release guards need about one publicly-addressed order.
 * Loaded strictly by (checkout slug, order_no) — a raw UUID never resolves. */
export interface ReleaseContext {
  orderId: string;
  orderNo: string;
  orderStatus: string;
  paymentStatus: string | null;
  shipmentStatus: string | null;
  escrow: {
    id: string;
    status: string;
    contractOrderId: string | null;
    buyerPublicKey: string | null;
    sellerPublicKey: string | null;
    amountUsdc: string;
    releaseTxHash: string | null;
  } | null;
  /** True when any refund/dispute request is open (not rejected/completed). */
  hasOpenRefundRequest: boolean;
}

export interface ReleaseStore {
  loadReleaseContext(input: {
    slug: string;
    orderNo: string;
  }): Promise<ReleaseContext | null>;

  /** Conditional orders.status shipped→delivered + shipments delivered(+at) +
   * order_status_events(actor_type='buyer'). applied=false when the order was
   * no longer 'shipped' (concurrent writer wins). */
  markOrderDelivered(input: {
    orderId: string;
    deliveredAt: string;
  }): Promise<{ applied: boolean }>;

  /** Idempotently record a submitted (not yet confirmed) release tx so a crash
   * between submit and confirm can be healed later. Never touches status. */
  recordReleaseSubmitted(input: {
    orderId: string;
    escrowId: string;
    txHash: string;
    sourceAccount: string;
    amountUsdc: string;
    network: NetworkName;
  }): Promise<void>;

  /** Latest known escrow_release tx hash for the order (submitted or
   * confirmed), for the heal path when escrows.release_tx_hash is unset. */
  findReleaseTxHash(orderId: string): Promise<string | null>;

  /** Atomic chain-verified release record (confirm_released_payment RPC):
   * escrow funded→released, order delivered→completed, audit rows. Idempotent
   * on tx hash; rejects any other state. */
  confirmReleased(input: {
    orderId: string;
    escrowId: string;
    txHash: string;
    ledger: number | null;
    toPublicKey: string | null;
    amountUsdc: string;
    network: NetworkName;
  }): Promise<{ applied: boolean }>;
}

export interface ReleaseDeps {
  store: ReleaseStore;
  gateway: EscrowGateway;
  config: {
    networkPassphrase: string;
    networkName: NetworkName;
    /** Server-only HMAC secret for confirm-received challenges (shared with
     * the wallet-challenge secret). Unset = fail closed. */
    walletChallengeSecret?: string;
  };
}

// --- Challenge issuance --------------------------------------------------------

export interface ConfirmReceivedChallengeResult {
  /** Unsigned challenge transaction for the buyer's funding wallet to sign. */
  challengeXdr: string;
  challengeToken: string;
  expiresAt: string;
  /** The wallet that must sign (the escrow's funding wallet). Public info —
   * the funding account is already visible on-chain via the payment tx. */
  buyerPublicKey: string;
  networkPassphrase: string;
}

function requireNetwork(deps: ReleaseDeps, declared: string | undefined): void {
  if (!declared) {
    throw new PaymentError("InvalidInput", "networkPassphrase is required");
  }
  if (declared !== deps.config.networkPassphrase) {
    throw new PaymentError(
      "WrongNetwork",
      "request network does not match the active server network",
    );
  }
}

const notFound = () => new PaymentError("CheckoutNotFound", "order not found");

/** The buyer key the proof must come from: the wallet frozen on the escrow at
 * funding time. Fail closed when unknown. */
function fundingWalletOf(ctx: ReleaseContext): string {
  const key = ctx.escrow?.buyerPublicKey;
  if (!key) {
    throw new PaymentError(
      "Conflict",
      "the funding wallet for this order is unknown",
    );
  }
  return key;
}

/**
 * ISSUE CONFIRM-RECEIVED CHALLENGE — public route, authorized by possession of
 * (slug, order_no) ONLY for issuance (signing is what actually proves the
 * buyer). One generic 404 for missing AND ineligible orders (no oracle).
 */
export async function issueConfirmReceivedChallenge(
  deps: ReleaseDeps,
  input: { slug: string; orderNo: string; networkPassphrase: string },
  now: number = Date.now(),
): Promise<ConfirmReceivedChallengeResult> {
  requireNetwork(deps, input.networkPassphrase);
  const secret = deps.config.walletChallengeSecret;
  if (!secret) {
    throw new PaymentError(
      "WalletChallengeUnavailable",
      "confirm-received challenges are not configured",
    );
  }

  const ctx = await deps.store.loadReleaseContext(input);
  // Eligible = shipped + funded + confirmed payment (or a retryable partial
  // state, handled by confirm). Anything else is the same generic 404.
  if (
    !ctx ||
    !ctx.escrow ||
    !["shipped", "delivered"].includes(ctx.orderStatus) ||
    ctx.paymentStatus !== "confirmed"
  ) {
    throw notFound();
  }
  const buyerPublicKey = fundingWalletOf(ctx);

  const nonce = generateChallengeNonce();
  const challengeXdr = buildWalletChallengeTx({
    walletPublicKey: buyerPublicKey,
    networkPassphrase: deps.config.networkPassphrase,
    nonce,
  });
  const challengeToken = createConfirmReceivedToken(
    secret,
    {
      slug: input.slug,
      orderNo: input.orderNo,
      buyerPublicKey,
      networkPassphrase: deps.config.networkPassphrase,
    },
    nonce,
    now,
  );
  return {
    challengeXdr,
    challengeToken,
    expiresAt: new Date(now + CONFIRM_RECEIVED_TOKEN_TTL_MS).toISOString(),
    buyerPublicKey,
    networkPassphrase: deps.config.networkPassphrase,
  };
}

// --- Confirm + release ----------------------------------------------------------

export interface ConfirmOrderReceivedInput {
  slug: string;
  orderNo: string;
  signedChallengeXdr: string;
  challengeToken: string;
  networkPassphrase: string;
}

export interface ConfirmOrderReceivedResult {
  orderNo: string;
  orderStatus: "completed";
  escrowStatus: "released";
  releaseTxHash: string;
}

const RELEASE_CONFIRM_ATTEMPTS = 8;
const RELEASE_CONFIRM_DELAY_MS = 1500;
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * CONFIRM RECEIVED + RELEASE — the ONLY path that releases escrowed funds.
 *
 * Guards (all fail closed): valid single-purpose HMAC challenge token; a
 * challenge signature from the EXACT funding wallet; order shipped (or a
 * retryable partial state); shipment shipped; payment confirmed; DB escrow
 * funded; no open refund/dispute; fresh on-chain read = Funded with matching
 * amount / buyer / frozen payout recipient. Only then: record delivered
 * (buyer action), operator-sign + submit release_to_recipient, poll until the
 * chain reads Released, and record the release atomically (RPC).
 *
 * Partial failure: delivered persists and is retryable; released/completed is
 * written ONLY after the chain reads Released. Re-calls converge: an on-chain
 * Released with a lagging DB heals via the idempotent RPC; double release is
 * impossible (contract InvalidStatus + RPC funded-guard).
 */
export async function confirmOrderReceivedAndRelease(
  deps: ReleaseDeps,
  input: ConfirmOrderReceivedInput,
  now: number = Date.now(),
): Promise<ConfirmOrderReceivedResult> {
  requireNetwork(deps, input.networkPassphrase);
  const secret = deps.config.walletChallengeSecret;
  if (!secret) {
    throw new PaymentError(
      "WalletChallengeUnavailable",
      "confirm-received challenges are not configured",
    );
  }

  const ctx = await deps.store.loadReleaseContext({
    slug: input.slug,
    orderNo: input.orderNo,
  });
  if (!ctx || !ctx.escrow) throw notFound();
  const escrow = ctx.escrow;
  const buyerPublicKey = fundingWalletOf(ctx);

  // --- Buyer proof FIRST: (slug, order_no) possession alone never releases. ---
  const nonce = verifyConfirmReceivedToken(
    secret,
    input.challengeToken,
    {
      slug: input.slug,
      orderNo: input.orderNo,
      buyerPublicKey,
      networkPassphrase: deps.config.networkPassphrase,
    },
    now,
  );
  if (!nonce) {
    throw new PaymentError(
      "Forbidden",
      "missing, expired, or invalid confirm-received challenge token",
    );
  }
  if (
    !verifyWalletChallengeTx({
      signedXdr: input.signedChallengeXdr,
      walletPublicKey: buyerPublicKey,
      networkPassphrase: deps.config.networkPassphrase,
      nonce,
    })
  ) {
    throw new PaymentError(
      "WrongBuyer",
      "the signature does not prove ownership of the funding wallet",
    );
  }

  // Idempotent success: already released + completed.
  if (escrow.status === "released" && ctx.orderStatus === "completed") {
    return {
      orderNo: ctx.orderNo,
      orderStatus: "completed",
      escrowStatus: "released",
      releaseTxHash: escrow.releaseTxHash ?? "",
    };
  }

  // --- State guards -----------------------------------------------------------
  if (ctx.hasOpenRefundRequest) {
    throw new PaymentError(
      "Conflict",
      "a refund request is open for this order; release is blocked",
    );
  }
  if (ctx.paymentStatus !== "confirmed") {
    throw new PaymentError("Conflict", "payment is not confirmed");
  }
  // shipped = normal path; delivered = retry after an earlier partial failure.
  if (ctx.orderStatus !== "shipped" && ctx.orderStatus !== "delivered") {
    throw new PaymentError(
      "Conflict",
      `order is not confirmable (status: ${ctx.orderStatus})`,
    );
  }
  if (ctx.orderStatus === "shipped" && ctx.shipmentStatus !== "shipped") {
    throw new PaymentError("Conflict", "shipment has not been shipped");
  }
  if (!escrow.contractOrderId) {
    throw new PaymentError("Conflict", "escrow linkage is missing");
  }
  if (escrow.status !== "funded" && escrow.status !== "released") {
    throw new PaymentError(
      "Conflict",
      `escrow is not releasable (status: ${escrow.status})`,
    );
  }

  // --- Fresh on-chain truth ----------------------------------------------------
  const onchain = await deps.gateway.readOrder(escrow.contractOrderId);
  if (!onchain) {
    throw new PaymentError("RpcFailure", "could not read the on-chain order");
  }
  if (onchain.buyer !== buyerPublicKey) {
    throw new PaymentError(
      "WrongBuyer",
      "on-chain order buyer does not match the funding wallet",
    );
  }
  if (onchain.amount !== usdcToUnits(escrow.amountUsdc)) {
    throw new PaymentError(
      "AmountMismatch",
      "on-chain order amount does not match the escrow record",
    );
  }
  if (
    onchain.payoutRecipient &&
    escrow.sellerPublicKey &&
    onchain.payoutRecipient !== escrow.sellerPublicKey
  ) {
    throw new PaymentError(
      "ChainOrderMismatch",
      "on-chain payout recipient does not match the recorded seller wallet",
    );
  }
  if (onchain.status !== "Funded" && onchain.status !== "Released") {
    throw new PaymentError(
      "Conflict",
      `on-chain escrow is not releasable (status: ${onchain.status})`,
    );
  }

  // --- Record the buyer's action: shipped → delivered ---------------------------
  const nowIso = new Date(now).toISOString();
  if (ctx.orderStatus === "shipped") {
    const { applied } = await deps.store.markOrderDelivered({
      orderId: ctx.orderId,
      deliveredAt: nowIso,
    });
    if (!applied) {
      throw new PaymentError(
        "Conflict",
        "order status changed concurrently; reload and retry",
      );
    }
  }

  // --- Release (or heal an already-Released chain) -------------------------------
  let releaseTxHash: string;
  let ledger: number | null = null;

  if (onchain.status === "Released") {
    // Chain already released (prior partial run) — recover the tx hash.
    const known =
      escrow.releaseTxHash ?? (await deps.store.findReleaseTxHash(ctx.orderId));
    if (!known) {
      throw new PaymentError(
        "Conflict",
        "escrow is released on-chain but the release transaction is unknown; requires operator reconciliation",
      );
    }
    releaseTxHash = known;
  } else {
    let releaseRes;
    try {
      releaseRes = await deps.gateway.releaseOrder({
        contractOrderIdHex: escrow.contractOrderId,
      });
    } catch (e) {
      if (e instanceof OperatorSignerError) {
        throw new PaymentError(e.code, e.message);
      }
      throw new PaymentError(
        "RpcFailure",
        "could not submit the release transaction; please retry",
        e,
      );
    }
    if (releaseRes.status === "ERROR") {
      throw new PaymentError(
        "SubmitRejected",
        "the network rejected the release transaction; please retry",
      );
    }
    if (releaseRes.status === "TRY_AGAIN_LATER") {
      throw new PaymentError(
        "RpcFailure",
        "the network is busy; please retry the confirmation",
      );
    }
    releaseTxHash = releaseRes.hash;
    // Persist the submitted hash BEFORE confirmation so a crash is healable.
    await deps.store.recordReleaseSubmitted({
      orderId: ctx.orderId,
      escrowId: escrow.id,
      txHash: releaseTxHash,
      sourceAccount: releaseRes.sourceAccount,
      amountUsdc: escrow.amountUsdc,
      network: deps.config.networkName,
    });

    // Poll until the tx lands, then require the chain to read Released.
    let landed = false;
    for (let i = 0; i < RELEASE_CONFIRM_ATTEMPTS; i++) {
      const res = await deps.gateway.getTransactionResult(releaseTxHash);
      if (res.status === "SUCCESS") {
        ledger = res.ledger ?? null;
        landed = true;
        break;
      }
      if (res.status === "FAILED") {
        throw new PaymentError(
          "SubmitRejected",
          "the release transaction failed on-chain; please retry",
        );
      }
      if (i < RELEASE_CONFIRM_ATTEMPTS - 1)
        await sleep(RELEASE_CONFIRM_DELAY_MS);
    }
    if (!landed) {
      throw new PaymentError(
        "RpcFailure",
        "release submitted but not yet confirmed; please retry to finalize",
      );
    }
    const after = await deps.gateway.readOrder(escrow.contractOrderId);
    if (!after || after.status !== "Released") {
      throw new PaymentError(
        "Conflict",
        "release transaction landed but the on-chain order is not Released",
      );
    }
  }

  // --- Atomic DB record: escrow released + order completed + audit rows ----------
  await deps.store.confirmReleased({
    orderId: ctx.orderId,
    escrowId: escrow.id,
    txHash: releaseTxHash,
    ledger,
    toPublicKey: escrow.sellerPublicKey,
    amountUsdc: escrow.amountUsdc,
    network: deps.config.networkName,
  });

  return {
    orderNo: ctx.orderNo,
    orderStatus: "completed",
    escrowStatus: "released",
    releaseTxHash,
  };
}
