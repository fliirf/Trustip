import {
  contractOrderIdToHex,
  deriveContractOrderId,
  type EscrowGateway,
  type EscrowStatusName,
  type GatewayOrderView,
  isValidPublicKey,
  OperatorSignerError,
} from "@trustip/stellar";
import { createAttemptToken, verifyAttemptToken } from "./attempt-token.js";
import { PaymentError } from "./errors.js";
import { usdcToUnits } from "./money.js";
import type {
  EscrowStatus,
  NetworkName,
  PaymentContext,
  PaymentStore,
} from "./ports.js";

/** Static, network-scoped config injected into the service (server-derived). */
export interface PaymentConfig {
  networkPassphrase: string;
  networkName: NetworkName;
  escrowContractId: string;
  /**
   * Server-only HMAC secret for prepare→submit attempt tokens. When set, submit
   * requires a valid token issued by prepare. When unset (e.g. local dev before
   * the secret is provisioned), token enforcement is skipped and the HIGH-1
   * on-tx binding remains the primary protection.
   */
  attemptSecret?: string;
}

export interface PaymentDeps {
  store: PaymentStore;
  gateway: EscrowGateway;
  config: PaymentConfig;
}

/** Requester identity for status reads. `null` userId = unauthenticated. */
export interface PaymentActor {
  userId: string | null;
  sellerProfileId?: string | null;
  isAdmin?: boolean;
}

// --- Inputs -----------------------------------------------------------------

export interface PrepareInput {
  orderId: string;
  buyerPublicKey: string;
  networkPassphrase: string;
}

export interface SubmitInput {
  paymentId: string;
  signedXdr: string;
  networkPassphrase: string;
  /** Attempt token issued by prepare (required when a secret is configured). */
  attemptToken?: string;
}

export interface SyncInput {
  paymentId: string;
}

// --- Outputs ----------------------------------------------------------------

export interface PrepareResult {
  paymentId: string;
  unsignedXdr: string;
  networkPassphrase: string;
  contractOrderId: string;
  expectedAmount: string;
  expectedAmountUnits: string;
  /** Present when attempt-token enforcement is configured. */
  attemptToken?: string;
}

export interface SubmitResult {
  paymentId: string;
  status: "submitted" | "confirmed";
  txHash: string;
  alreadyProcessed: boolean;
}

export interface SyncResult {
  paymentId: string;
  status: "submitted" | "confirmed" | "failed";
  txHash: string | null;
  pending: boolean;
  applied: boolean;
}

export interface StatusResult {
  paymentId: string;
  orderId: string;
  paymentStatus: string;
  orderStatus: string;
  escrowStatus: string | null;
  amountUsdc: string;
  network: NetworkName;
  payerPublicKey: string | null;
  txHash: string | null;
  ledger: number | null;
  confirmedAt: string | null;
}

// ---------------------------------------------------------------------------

const ESCROW_STATUS_DB: Record<EscrowStatusName, EscrowStatus> = {
  Created: "created",
  Funded: "funded",
  Released: "released",
  Refunded: "refunded",
  Cancelled: "cancelled",
};

/** Fail-closed network guard: the network is required and must match the server. */
function requireNetwork(deps: PaymentDeps, declared: string | undefined): void {
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

// ---------------------------------------------------------------------------
// ESCROW create_order orchestration (Phase 4.1)
// ---------------------------------------------------------------------------

export interface EnsureEscrowInput {
  orderId: string;
  /** Buyer wallet public key, known only after the buyer connects a wallet. */
  buyerPublicKey: string;
  networkPassphrase: string;
}

export interface EnsureEscrowResult {
  orderId: string;
  escrowId: string;
  contractOrderId: string;
  escrowStatus: EscrowStatus;
  /** create_order tx hash when this call created it; null when reconciled. */
  txHash: string | null;
  alreadyExisted: boolean;
}

/** Fund-window expiry (unix seconds) for a Created, not-yet-funded order. A
 * Created order locks no funds, so a generous window just bounds how long the
 * buyer has to fund; picked long enough to never expire a live checkout. */
const ESCROW_FUND_WINDOW_SECONDS = 7n * 24n * 60n * 60n; // 7 days
const CREATE_CONFIRM_ATTEMPTS = 8;
const CREATE_CONFIRM_DELAY_MS = 1500;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * ENSURE ON-CHAIN ESCROW ORDER CREATED — the admin/operator-authorized step that
 * MUST run before buyer fund prepare/submit. For guest checkout the buyer key is
 * known only after wallet connect, so this binds that exact key into the escrow
 * (and on-chain order) here.
 *
 * Idempotent + reconciling, and never touches money state:
 *   * on-chain order already exists → validate buyer+amount, reconcile the DB
 *     escrow row, return `alreadyExisted` (never re-creates);
 *   * not present → admin-sign + submit create_order, confirm the chain reads
 *     Created, then record escrow=created + the create tx/event;
 *   * concurrent/duplicate calls converge on ONE on-chain order (the contract
 *     rejects duplicate ids; we reconcile by re-reading get_order).
 * Funding stays buyer-signed (prepare/submit); confirmation stays with sync.
 */
export async function ensureOnChainEscrowOrderCreated(
  deps: PaymentDeps,
  input: EnsureEscrowInput,
): Promise<EnsureEscrowResult> {
  requireNetwork(deps, input.networkPassphrase);

  if (!isValidPublicKey(input.buyerPublicKey)) {
    throw new PaymentError("InvalidBuyerPublicKey", "invalid buyer public key");
  }

  const ctx = await deps.store.loadByOrderId(input.orderId);
  if (!ctx) throw new PaymentError("OrderNotFound", "order not found");

  const contractOrderId = contractOrderIdToHex(
    deriveContractOrderId(ctx.order.id),
  );
  const expectedUnits = usdcToUnits(ctx.order.totalUsdc);

  // Idempotency FIRST: if the order already exists on-chain, reconcile — never
  // re-create. This also collapses concurrent callers onto one on-chain order.
  const existing = await deps.gateway.readOrder(contractOrderId);
  if (existing) {
    return reconcileExisting(
      deps,
      ctx.order.id,
      ctx.order.totalUsdc,
      contractOrderId,
      expectedUnits,
      existing,
      input.buyerPublicKey,
    );
  }

  // --- Fresh creation path — eligibility is gated only here. ----------------
  if (ctx.order.status !== "awaiting_payment") {
    throw new PaymentError(
      "OrderNotEligible",
      `order is not eligible for escrow creation (status: ${ctx.order.status})`,
    );
  }
  if (
    ctx.buyerWalletPublicKey &&
    ctx.buyerWalletPublicKey !== input.buyerPublicKey
  ) {
    throw new PaymentError(
      "WrongBuyer",
      "buyer public key does not match the order's bound wallet",
    );
  }
  // The seller's payout wallet (USDC_WALLET route) is the on-chain seller and
  // payout recipient — derived server-side, never from the client.
  const sellerPublicKey = ctx.sellerWalletPublicKey;
  if (!sellerPublicKey || !isValidPublicKey(sellerPublicKey)) {
    throw new PaymentError(
      "OrderNotEligible",
      "seller has no valid payout wallet configured for escrow creation",
    );
  }
  if (sellerPublicKey === input.buyerPublicKey) {
    throw new PaymentError(
      "OrderNotEligible",
      "buyer and seller wallets must differ",
    );
  }

  const expiresAt =
    BigInt(Math.floor(Date.now() / 1000)) + ESCROW_FUND_WINDOW_SECONDS;

  let createRes;
  try {
    createRes = await deps.gateway.createOrder({
      buyerPublicKey: input.buyerPublicKey,
      sellerPublicKey,
      payoutRecipient: sellerPublicKey,
      contractOrderIdHex: contractOrderId,
      amountUnits: expectedUnits,
      expiresAt,
    });
  } catch (e) {
    if (e instanceof OperatorSignerError) {
      // 1:1 code mapping (AdminSignerMissing | AdminSignerNotAllowedOnMainnet).
      throw new PaymentError(e.code, e.message);
    }
    // Build/simulate/submit threw — a concurrent create may have won the race.
    const raced = await deps.gateway.readOrder(contractOrderId);
    if (raced) {
      return reconcileExisting(
        deps,
        ctx.order.id,
        ctx.order.totalUsdc,
        contractOrderId,
        expectedUnits,
        raced,
        input.buyerPublicKey,
      );
    }
    throw new PaymentError(
      "EscrowCreateFailed",
      "could not create the on-chain escrow order",
      e,
    );
  }

  if (createRes.status === "ERROR") {
    // May be the contract's OrderAlreadyExists (race). Reconcile if readable.
    const raced = await deps.gateway.readOrder(contractOrderId);
    if (raced) {
      return reconcileExisting(
        deps,
        ctx.order.id,
        ctx.order.totalUsdc,
        contractOrderId,
        expectedUnits,
        raced,
        input.buyerPublicKey,
      );
    }
    throw new PaymentError(
      "EscrowCreateFailed",
      "the network rejected create_order",
    );
  }
  if (createRes.status === "TRY_AGAIN_LATER") {
    throw new PaymentError(
      "RpcFailure",
      "the network is busy; please retry escrow creation",
    );
  }

  // PENDING/DUPLICATE — confirm the tx landed and the chain reads Created.
  const confirmed = await confirmCreated(deps, createRes.hash, contractOrderId);
  if (!confirmed) {
    // Submitted but not yet confirmed Created — retryable; the next call
    // reconciles once it lands (no duplicate on-chain order is ever created).
    throw new PaymentError(
      "RpcFailure",
      "create_order submitted but not yet confirmed; please retry",
    );
  }
  if (confirmed.view.buyer !== input.buyerPublicKey) {
    throw new PaymentError(
      "WrongBuyer",
      "on-chain order buyer does not match the paying wallet",
    );
  }
  if (confirmed.view.amount !== expectedUnits) {
    throw new PaymentError(
      "ChainOrderMismatch",
      "on-chain order amount does not match the order total",
    );
  }

  const escrow = await deps.store.linkEscrowRow({
    orderId: ctx.order.id,
    contractId: deps.config.escrowContractId,
    contractOrderId,
    amountUsdc: ctx.order.totalUsdc,
    buyerPublicKey: input.buyerPublicKey,
    sellerPublicKey,
    onChainStatus: "created",
  });

  await deps.store.recordEscrowCreationTx({
    escrowId: escrow.id,
    orderId: ctx.order.id,
    txHash: createRes.hash,
    sourceAccount: createRes.sourceAccount,
    amountUsdc: ctx.order.totalUsdc,
    network: deps.config.networkName,
    ledger: confirmed.ledger,
    buyerPublicKey: input.buyerPublicKey,
  });

  return {
    orderId: ctx.order.id,
    escrowId: escrow.id,
    contractOrderId,
    escrowStatus: "created",
    txHash: createRes.hash,
    alreadyExisted: false,
  };
}

/** Reconcile the DB escrow row to an on-chain order that already exists. Buyer
 * and amount are validated fail-closed; the escrow row is upserted idempotently
 * (linkEscrowRow never downgrades a funded/terminal escrow). */
async function reconcileExisting(
  deps: PaymentDeps,
  orderId: string,
  totalUsdc: string,
  contractOrderId: string,
  expectedUnits: bigint,
  onchain: GatewayOrderView,
  buyerPublicKey: string,
): Promise<EnsureEscrowResult> {
  if (onchain.buyer !== buyerPublicKey) {
    throw new PaymentError(
      "WrongBuyer",
      "on-chain order buyer does not match the paying wallet",
    );
  }
  if (onchain.amount !== expectedUnits) {
    throw new PaymentError(
      "ChainOrderMismatch",
      "on-chain order amount does not match the order total",
    );
  }
  const escrow = await deps.store.linkEscrowRow({
    orderId,
    contractId: deps.config.escrowContractId,
    contractOrderId,
    amountUsdc: totalUsdc,
    buyerPublicKey,
    sellerPublicKey: onchain.seller,
    onChainStatus: ESCROW_STATUS_DB[onchain.status],
  });
  return {
    orderId,
    escrowId: escrow.id,
    contractOrderId,
    escrowStatus: escrow.status,
    txHash: escrow.fundedTxHash,
    alreadyExisted: true,
  };
}

/** Poll a submitted create_order until the chain reports the order Created.
 * Returns the on-chain view + ledger only on a confirmed Created; null on
 * failure/timeout (caller treats null as retryable, never as success). */
async function confirmCreated(
  deps: PaymentDeps,
  txHash: string,
  contractOrderId: string,
): Promise<{ view: GatewayOrderView; ledger: number | null } | null> {
  for (let i = 0; i < CREATE_CONFIRM_ATTEMPTS; i++) {
    const res = await deps.gateway.getTransactionResult(txHash);
    if (res.status === "SUCCESS") {
      const view = await deps.gateway.readOrder(contractOrderId);
      if (view && view.status === "Created") {
        return { view, ledger: res.ledger ?? null };
      }
      return null;
    }
    if (res.status === "FAILED") return null;
    // NOT_FOUND — wait and retry (skip the delay after the final attempt).
    if (i < CREATE_CONFIRM_ATTEMPTS - 1) await sleep(CREATE_CONFIRM_DELAY_MS);
  }
  return null;
}

/**
 * PREPARE — validate a payable order and return the buyer's unsigned
 * `fund_order` XDR. Never marks paid, never submits. The on-chain order MUST
 * already exist in `Created` state (the admin/worker `create_order` step is out
 * of Phase 4 scope); if it does not, this returns a typed `EscrowNotReady`.
 */
export async function preparePayment(
  deps: PaymentDeps,
  input: PrepareInput,
): Promise<PrepareResult> {
  requireNetwork(deps, input.networkPassphrase);

  if (!isValidPublicKey(input.buyerPublicKey)) {
    throw new PaymentError("InvalidInput", "invalid buyer public key");
  }

  const ctx = await deps.store.loadByOrderId(input.orderId);
  if (!ctx) throw new PaymentError("OrderNotFound", "order not found");

  if (ctx.order.status !== "awaiting_payment") {
    throw new PaymentError(
      "OrderNotPayable",
      `order is not awaiting payment (status: ${ctx.order.status})`,
    );
  }

  // If the order is bound to a specific buyer wallet, the payer must match it.
  if (
    ctx.buyerWalletPublicKey &&
    ctx.buyerWalletPublicKey !== input.buyerPublicKey
  ) {
    throw new PaymentError(
      "WrongBuyer",
      "buyer public key does not match the order's bound wallet",
    );
  }

  const contractOrderId = contractOrderIdToHex(
    deriveContractOrderId(ctx.order.id),
  );
  const expectedUnits = usdcToUnits(ctx.order.totalUsdc);

  // Verify the on-chain order is created, matches amount, and matches buyer.
  const onchain = await deps.gateway.readOrder(contractOrderId);
  if (!onchain) {
    throw new PaymentError(
      "EscrowNotReady",
      "on-chain escrow order has not been created yet",
    );
  }
  if (onchain.status === "Funded") {
    throw new PaymentError(
      "EscrowAlreadyFunded",
      "on-chain escrow order is already funded",
    );
  }
  if (onchain.status !== "Created") {
    throw new PaymentError(
      "OrderNotPayable",
      `on-chain escrow order is not payable (status: ${onchain.status})`,
    );
  }
  if (onchain.amount !== expectedUnits) {
    throw new PaymentError(
      "AmountMismatch",
      "on-chain order amount does not match the order total",
    );
  }
  if (onchain.buyer !== input.buyerPublicKey) {
    throw new PaymentError(
      "WrongBuyer",
      "on-chain order buyer does not match the paying wallet",
    );
  }

  // Build the unsigned fund tx BEFORE any DB mutation, so a build failure never
  // leaves partial state.
  let unsignedXdr: string;
  try {
    unsignedXdr = await deps.gateway.buildFundOrderXdr({
      buyerPublicKey: input.buyerPublicKey,
      contractOrderIdHex: contractOrderId,
      amountUnits: expectedUnits,
    });
  } catch (e) {
    throw new PaymentError(
      "RpcFailure",
      "could not build the fund transaction; the buyer account may be missing or unfunded on the active network",
      e,
    );
  }

  const payment = await deps.store.preparePaymentRow({
    orderId: ctx.order.id,
    amountUsdc: ctx.order.totalUsdc,
    network: deps.config.networkName,
    payerPublicKey: input.buyerPublicKey,
  });

  await deps.store.linkEscrowRow({
    orderId: ctx.order.id,
    contractId: deps.config.escrowContractId,
    contractOrderId,
    amountUsdc: ctx.order.totalUsdc,
    buyerPublicKey: input.buyerPublicKey,
    sellerPublicKey: ctx.sellerWalletPublicKey,
    onChainStatus: ESCROW_STATUS_DB[onchain.status],
  });

  const attemptToken = deps.config.attemptSecret
    ? createAttemptToken(deps.config.attemptSecret, {
        paymentId: payment.id,
        contractOrderId,
      })
    : undefined;

  return {
    paymentId: payment.id,
    unsignedXdr,
    networkPassphrase: deps.config.networkPassphrase,
    contractOrderId,
    expectedAmount: ctx.order.totalUsdc,
    expectedAmountUnits: expectedUnits.toString(),
    attemptToken,
  };
}

/**
 * SUBMIT — accept a wallet-signed XDR and forward it to the network. The signed
 * tx is bound fail-closed to THIS prepared attempt: source, invoked contract,
 * function name, order id, buyer argument, and amount must all match the payment
 * before it is forwarded. Sets status to `submitted` only — escrow is never
 * marked funded here (that happens in SYNC after on-chain verification).
 */
export async function submitPayment(
  deps: PaymentDeps,
  input: SubmitInput,
): Promise<SubmitResult> {
  requireNetwork(deps, input.networkPassphrase);

  const ctx = await deps.store.loadByPaymentId(input.paymentId);
  if (!ctx || !ctx.payment) {
    throw new PaymentError("PaymentNotFound", "payment not found");
  }
  const payment = ctx.payment;

  // Idempotent short-circuits: never resubmit an already-progressed payment.
  if (payment.status === "confirmed") {
    return {
      paymentId: payment.id,
      status: "confirmed",
      txHash: payment.txHash ?? "",
      alreadyProcessed: true,
    };
  }
  if (payment.status === "submitted" && payment.txHash) {
    return {
      paymentId: payment.id,
      status: "submitted",
      txHash: payment.txHash,
      alreadyProcessed: true,
    };
  }

  // Escrow linkage is required to bind the tx to an order (fail closed).
  const escrow = ctx.escrow;
  if (!escrow || !escrow.contractOrderId) {
    throw new PaymentError(
      "Conflict",
      "escrow linkage is missing for this payment",
    );
  }

  // Attempt token (defense-in-depth): submit must follow a server-side prepare.
  if (deps.config.attemptSecret) {
    if (
      !input.attemptToken ||
      !verifyAttemptToken(deps.config.attemptSecret, input.attemptToken, {
        paymentId: payment.id,
        contractOrderId: escrow.contractOrderId,
      })
    ) {
      throw new PaymentError("Forbidden", "missing or invalid prepare token");
    }
  }

  // Statically inspect + decode the signed tx (offline).
  let parsed;
  try {
    parsed = deps.gateway.parseFundTx(input.signedXdr);
  } catch (e) {
    throw new PaymentError("InvalidSignedTx", "could not parse signed XDR", e);
  }

  // ---- Fail-closed binding of the signed tx to this prepared attempt --------
  const expectedBuyer = payment.payerPublicKey ?? escrow.buyerPublicKey;
  if (!expectedBuyer) {
    throw new PaymentError(
      "Conflict",
      "expected buyer is unknown for this payment",
    );
  }
  if (!parsed.invokesContract) {
    throw new PaymentError(
      "InvalidSignedTx",
      "signed tx does not invoke a contract",
    );
  }
  if (!parsed.contractId) {
    throw new PaymentError(
      "InvalidSignedTx",
      "could not determine the invoked contract",
    );
  }
  if (parsed.contractId !== deps.config.escrowContractId) {
    throw new PaymentError(
      "InvalidSignedTx",
      "signed tx targets an unexpected contract",
    );
  }
  if (parsed.functionName !== "fund_order") {
    throw new PaymentError(
      "InvalidSignedTx",
      "signed tx is not a fund_order call",
    );
  }
  if (
    !parsed.contractOrderId ||
    parsed.contractOrderId.toLowerCase() !==
      escrow.contractOrderId.toLowerCase()
  ) {
    throw new PaymentError(
      "InvalidSignedTx",
      "signed tx funds a different order",
    );
  }
  if (parsed.source !== expectedBuyer) {
    throw new PaymentError(
      "InvalidSignedTx",
      "signed tx source does not match the prepared buyer",
    );
  }
  if (parsed.buyer && parsed.buyer !== expectedBuyer) {
    throw new PaymentError(
      "InvalidSignedTx",
      "signed tx buyer argument does not match the prepared buyer",
    );
  }
  if (parsed.amountUnits === undefined) {
    throw new PaymentError(
      "InvalidSignedTx",
      "could not determine the fund amount",
    );
  }
  const expectedUnits = usdcToUnits(payment.amountUsdc);
  if (parsed.amountUnits !== expectedUnits) {
    throw new PaymentError(
      "AmountMismatch",
      "signed tx amount does not match the order total",
    );
  }
  // ---------------------------------------------------------------------------

  // Duplicate tx-hash detection (prevents replay across payments).
  const existing = await deps.store.findPaymentByTxHash(parsed.hash);
  if (existing && existing.id !== payment.id) {
    throw new PaymentError(
      "DuplicateTx",
      "this transaction is already associated with another payment",
    );
  }
  if (
    existing &&
    existing.id === payment.id &&
    existing.txHash === parsed.hash
  ) {
    return {
      paymentId: payment.id,
      status: existing.status === "confirmed" ? "confirmed" : "submitted",
      txHash: parsed.hash,
      alreadyProcessed: true,
    };
  }

  const send = await deps.gateway.submit(input.signedXdr);

  if (send.status === "PENDING" || send.status === "DUPLICATE") {
    await deps.store.recordSubmission({
      paymentId: payment.id,
      orderId: ctx.order.id,
      escrowId: escrow.id,
      txHash: parsed.hash,
      sourceAccount: parsed.source,
      amountUsdc: payment.amountUsdc,
      network: payment.network,
      rawResponse: { status: send.status, hash: send.hash },
    });
    return {
      paymentId: payment.id,
      status: "submitted",
      txHash: parsed.hash,
      alreadyProcessed: false,
    };
  }

  if (send.status === "ERROR") {
    await deps.store.recordFailure({
      paymentId: payment.id,
      txHash: parsed.hash,
      reason: send.errorResult ?? "stellar rejected the transaction",
    });
    throw new PaymentError(
      "SubmitRejected",
      "the network rejected the transaction",
    );
  }

  // TRY_AGAIN_LATER — transient; do not mark failed, let the client retry.
  throw new PaymentError(
    "RpcFailure",
    "the network is busy; please retry submission",
  );
}

/**
 * SYNC — verify the submitted tx's on-chain result and update the DB truthfully.
 * Idempotent: a confirmed payment is never re-verified but IS reconciled (self-
 * heal) so a partially-applied prior confirm converges; a failed tx never marks
 * paid; only a SUCCESS whose on-chain order reads `Funded` (with matching
 * amount) confirms the payment and funds the escrow.
 */
export async function syncPayment(
  deps: PaymentDeps,
  input: SyncInput,
): Promise<SyncResult> {
  const ctx = await deps.store.loadByPaymentId(input.paymentId);
  if (!ctx || !ctx.payment) {
    throw new PaymentError("PaymentNotFound", "payment not found");
  }
  const payment = ctx.payment;

  if (payment.status === "confirmed") {
    // Self-heal: if a prior confirm only partially applied (e.g. a crash between
    // writes), re-run the idempotent confirm to reconcile escrow/order/event.
    // No chain call — a confirmed payment is already proven funded.
    const escrow = ctx.escrow;
    const needsHeal =
      !!escrow &&
      (escrow.status !== "funded" || ctx.order.status !== "escrow_locked");
    if (needsHeal && escrow && escrow.contractOrderId) {
      await deps.store.recordFundConfirmed({
        paymentId: payment.id,
        orderId: ctx.order.id,
        escrowId: escrow.id,
        txHash: payment.txHash ?? escrow.fundedTxHash ?? "",
        ledger: payment.ledger,
        buyerPublicKey: escrow.buyerPublicKey,
        amountUsdc: escrow.amountUsdc,
        network: payment.network,
      });
    }
    return {
      paymentId: payment.id,
      status: "confirmed",
      txHash: payment.txHash,
      pending: false,
      applied: false,
    };
  }
  if (payment.status === "failed") {
    return {
      paymentId: payment.id,
      status: "failed",
      txHash: payment.txHash,
      pending: false,
      applied: false,
    };
  }

  const txHash = payment.txHash;
  if (!txHash) {
    // Nothing submitted yet — nothing to verify.
    return {
      paymentId: payment.id,
      status: "submitted",
      txHash: null,
      pending: true,
      applied: false,
    };
  }

  const result = await deps.gateway.getTransactionResult(txHash);

  if (result.status === "NOT_FOUND") {
    return {
      paymentId: payment.id,
      status: "submitted",
      txHash,
      pending: true,
      applied: false,
    };
  }

  if (result.status === "FAILED") {
    await deps.store.recordFailure({
      paymentId: payment.id,
      txHash,
      reason: "transaction failed on-chain",
    });
    return {
      paymentId: payment.id,
      status: "failed",
      txHash,
      pending: false,
      applied: false,
    };
  }

  // SUCCESS — confirm against contract state, never on the tx result alone.
  const escrow = ctx.escrow;
  if (!escrow || !escrow.contractOrderId) {
    throw new PaymentError(
      "Conflict",
      "escrow linkage is missing for a succeeded payment",
    );
  }

  const onchain = await deps.gateway.readOrder(escrow.contractOrderId);
  if (!onchain) {
    throw new PaymentError(
      "RpcFailure",
      "could not read the on-chain order after success",
    );
  }
  const expectedUnits = usdcToUnits(escrow.amountUsdc);
  if (onchain.status !== "Funded") {
    throw new PaymentError(
      "Conflict",
      `on-chain order is not funded (status: ${onchain.status})`,
    );
  }
  if (onchain.amount !== expectedUnits) {
    throw new PaymentError(
      "AmountMismatch",
      "on-chain funded amount does not match the order total",
    );
  }

  const { applied } = await deps.store.recordFundConfirmed({
    paymentId: payment.id,
    orderId: ctx.order.id,
    escrowId: escrow.id,
    txHash,
    ledger: result.ledger ?? null,
    buyerPublicKey: escrow.buyerPublicKey,
    amountUsdc: escrow.amountUsdc,
    network: payment.network,
  });

  return {
    paymentId: payment.id,
    status: "confirmed",
    txHash,
    pending: false,
    applied,
  };
}

/** STATUS — read-only projection for UI polling. Fails closed for bound orders;
 * guest (unbound) orders are readable by holders of the payment id. */
export async function getPaymentStatus(
  deps: PaymentDeps,
  input: { paymentId: string; actor: PaymentActor },
): Promise<StatusResult> {
  const ctx = await deps.store.loadByPaymentId(input.paymentId);
  if (!ctx || !ctx.payment) {
    throw new PaymentError("PaymentNotFound", "payment not found");
  }
  assertStatusAccess(ctx, input.actor);

  const p = ctx.payment;
  return {
    paymentId: p.id,
    orderId: ctx.order.id,
    paymentStatus: p.status,
    orderStatus: ctx.order.status,
    escrowStatus: ctx.escrow?.status ?? null,
    amountUsdc: p.amountUsdc,
    network: p.network,
    payerPublicKey: p.payerPublicKey,
    txHash: p.txHash,
    ledger: p.ledger,
    confirmedAt: p.confirmedAt,
  };
}

function assertStatusAccess(ctx: PaymentContext, actor: PaymentActor): void {
  if (actor.isAdmin) return;
  // Guest order (no bound buyer user): payment id acts as the capability.
  if (ctx.order.buyerUserId === null) return;
  if (actor.userId && actor.userId === ctx.order.buyerUserId) return;
  if (
    actor.sellerProfileId &&
    actor.sellerProfileId === ctx.order.sellerProfileId
  ) {
    return;
  }
  throw new PaymentError("Forbidden", "not authorized to view this payment");
}
