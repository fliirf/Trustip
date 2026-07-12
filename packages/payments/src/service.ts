import {
  buildWalletChallengeTx,
  contractOrderIdToHex,
  deriveContractOrderId,
  type EscrowGateway,
  type EscrowStatusName,
  type GatewayOrderView,
  isValidPublicKey,
  OperatorSignerError,
  verifyWalletChallengeTx,
} from "@trustip/stellar";
import { randomBytes } from "node:crypto";
import { createAttemptToken, verifyAttemptToken } from "./attempt-token.js";
import {
  CHECKOUT_CHALLENGE_TOKEN_TTL_MS,
  CHECKOUT_TOKEN_DEFAULT_TTL_MS,
  createCheckoutChallengeToken,
  createCheckoutToken,
  verifyCheckoutChallengeToken,
  verifyCheckoutToken,
} from "./checkout-token.js";
import { PaymentError } from "./errors.js";
import { unitsToUsdc, usdcToUnits } from "./money.js";
import type {
  EscrowStatus,
  NetworkName,
  PaymentContext,
  PaymentStore,
} from "./ports.js";
import { generateChallengeNonce } from "./wallet-challenge-token.js";

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
  /**
   * Server-only HMAC secret for checkout / create-order authorization tokens.
   * When set, a guest (unauthenticated) caller must present a valid token bound
   * to {orderId, buyerPublicKey, contractOrderId, network} to trigger the
   * operator-signed create_order. When unset, the guest token path is
   * unavailable and only an authenticated order owner (or admin) may create —
   * anonymous callers always fail closed.
   */
  checkoutTokenSecret?: string;
  /**
   * Server-only HMAC secret for the checkout wallet-ownership challenge
   * (SEP-10 hardening). Shared with the seller/release wallet-challenge secret.
   * When set, `issueCheckoutToken` requires a valid signed challenge proving the
   * caller controls the buyer key before minting the checkout token. When unset,
   * the guest checkout path is unavailable (fail closed) — no token is minted.
   */
  walletChallengeSecret?: string;
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
  /** Auth email, when known — used only to seed the ensured users row. */
  email?: string | null;
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
  /**
   * Short-lived server-signed checkout token (guest checkout). Required to
   * authorize an unauthenticated caller when `config.checkoutTokenSecret` is
   * set; ignored for authenticated order owners / admins. Never a bearer of
   * amount/status/seller — only proof that this buyer key belongs to this order.
   */
  checkoutToken?: string;
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
 * Authorized (fail closed) before any DB/chain/operator work: the caller must
 * present a valid server-signed checkout token (guest) OR be the authenticated
 * order owner / admin — a raw orderId + buyer key is never sufficient.
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
  actor: PaymentActor,
): Promise<EnsureEscrowResult> {
  requireNetwork(deps, input.networkPassphrase);

  if (!isValidPublicKey(input.buyerPublicKey)) {
    throw new PaymentError("InvalidBuyerPublicKey", "invalid buyer public key");
  }

  // Deterministic on-chain id; also the token-bound claim (from the request
  // orderId, which the DB row must equal since we load orders by id).
  const contractOrderId = contractOrderIdToHex(
    deriveContractOrderId(input.orderId),
  );

  // --- AUTHORIZATION (M1) — fail closed BEFORE any DB/chain/operator work. ---
  // A stranger holding only a raw orderId + arbitrary buyer key must NOT be able
  // to trigger operator-signed create_order (it spends operator XLM fees). Two
  // accepted proofs: (a) a valid server-signed checkout token that binds THIS
  // buyer key to THIS order, or (b) an authenticated order owner / admin.
  const tokenOk =
    !!deps.config.checkoutTokenSecret &&
    !!input.checkoutToken &&
    verifyCheckoutToken(deps.config.checkoutTokenSecret, input.checkoutToken, {
      orderId: input.orderId,
      buyerPublicKey: input.buyerPublicKey,
      contractOrderId,
      networkPassphrase: input.networkPassphrase,
    });
  // Reject anonymous callers (no token, no session) before touching the DB, so
  // the endpoint is not even an order-existence oracle for the unauthenticated.
  if (!tokenOk && !actor.isAdmin && !actor.userId) {
    throw new PaymentError(
      "Forbidden",
      "create-order requires a valid checkout token or an authenticated buyer",
    );
  }

  const ctx = await deps.store.loadByOrderId(input.orderId);
  if (!ctx) throw new PaymentError("OrderNotFound", "order not found");

  // A token already binds buyer↔order; otherwise the authenticated caller must
  // own the order (or be admin). Guest orders (no buyerUserId) are creatable
  // only via a token — an authenticated stranger cannot claim them.
  if (!tokenOk && !actor.isAdmin && actor.userId !== ctx.order.buyerUserId) {
    throw new PaymentError(
      "Forbidden",
      "not authorized to create this escrow order",
    );
  }

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
 * and amount are validated fail-closed. The create path owns ONLY the `created`
 * status — funded/terminal on-chain states yield a typed conflict and write
 * nothing (M2); their DB transitions belong to payment sync / the indexer. */
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
  // M2: never adopt funded/released/refunded/cancelled from the create path.
  if (onchain.status !== "Created") {
    if (onchain.status === "Funded") {
      throw new PaymentError(
        "EscrowAlreadyFunded",
        "on-chain escrow order is already funded; confirm it via payment sync",
      );
    }
    throw new PaymentError(
      "ContractOrderAlreadyExists",
      `on-chain escrow order already exists in a non-creatable state (${onchain.status})`,
    );
  }
  const escrow = await deps.store.linkEscrowRow({
    orderId,
    contractId: deps.config.escrowContractId,
    contractOrderId,
    amountUsdc: totalUsdc,
    buyerPublicKey,
    sellerPublicKey: onchain.seller,
    onChainStatus: "created",
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

// ---------------------------------------------------------------------------
// CHECKOUT TOKEN ISSUANCE (Phase 5.0) — the trusted server-side mint point that
// makes guest checkout possible WITHOUT reopening anonymous operator-signing.
// ---------------------------------------------------------------------------

export interface IssueCheckoutTokenInput {
  /** Public checkout link slug the buyer is checking out from. */
  slug: string;
  /** Public order number (never a raw order UUID). */
  orderNo: string;
  /** Buyer wallet public key, known only after the buyer connects a wallet. */
  buyerPublicKey: string;
  networkPassphrase: string;
  /** SEP-10 proof: the challenge XDR (from `issueCheckoutChallenge`) signed by
   * the buyer wallet. Proves the caller controls `buyerPublicKey`. */
  signedChallengeXdr: string;
  /** The HMAC challenge token returned alongside the challenge XDR. */
  challengeToken: string;
}

/** Input for the wallet-ownership challenge that precedes token issuance. */
export interface IssueCheckoutChallengeInput {
  slug: string;
  orderNo: string;
  buyerPublicKey: string;
  networkPassphrase: string;
}

export interface IssueCheckoutChallengeResult {
  /** Unsigned SEP-10-style challenge for the buyer wallet to sign. */
  challengeXdr: string;
  /** HMAC token binding {slug, orderNo, buyerPublicKey, network} + nonce. */
  challengeToken: string;
  expiresAt: string;
  /** Echoed back so the client can confirm the challenge targets its key. */
  buyerPublicKey: string;
  networkPassphrase: string;
}

export interface IssueCheckoutTokenResult {
  checkoutToken: string;
  /** Token expiry as ISO-8601 (matches the expiry bound inside the token). */
  expiresAt: string;
  orderId: string;
  orderNo: string;
  contractOrderId: string;
  networkPassphrase: string;
  /** Server-derived order total, DISPLAY ONLY — never a trusted authority.
   * create_order and prepare re-derive and verify the amount on-chain. */
  amountUsdc: string;
}

/**
 * ISSUE CHECKOUT CHALLENGE — mint an unsigned wallet-ownership challenge for the
 * buyer key, plus a short-lived HMAC token binding it to this (slug, orderNo,
 * key, network). The buyer wallet signs the challenge and passes both back to
 * `issueCheckoutToken`. Deliberately does NO store read: it reveals nothing
 * about order existence (the real gate is at token issuance), so it is not an
 * order_no enumeration oracle. Fails closed when the challenge secret is unset.
 */
export async function issueCheckoutChallenge(
  deps: PaymentDeps,
  input: IssueCheckoutChallengeInput,
  now: number = Date.now(),
): Promise<IssueCheckoutChallengeResult> {
  requireNetwork(deps, input.networkPassphrase);

  const secret = deps.config.walletChallengeSecret;
  if (!secret) {
    throw new PaymentError(
      "WalletChallengeUnavailable",
      "checkout wallet-ownership proof is not configured",
    );
  }
  if (!isValidPublicKey(input.buyerPublicKey)) {
    throw new PaymentError("InvalidBuyerPublicKey", "invalid buyer public key");
  }

  const nonce = generateChallengeNonce();
  const challengeXdr = buildWalletChallengeTx({
    walletPublicKey: input.buyerPublicKey,
    networkPassphrase: deps.config.networkPassphrase,
    nonce,
  });
  const challengeToken = createCheckoutChallengeToken(
    secret,
    {
      slug: input.slug,
      orderNo: input.orderNo,
      buyerPublicKey: input.buyerPublicKey,
      // Bind the SERVER network (already validated to match the request).
      networkPassphrase: deps.config.networkPassphrase,
    },
    nonce,
    now,
  );
  return {
    challengeXdr,
    challengeToken,
    expiresAt: new Date(now + CHECKOUT_CHALLENGE_TOKEN_TTL_MS).toISOString(),
    buyerPublicKey: input.buyerPublicKey,
    networkPassphrase: deps.config.networkPassphrase,
  };
}

/**
 * ISSUE CHECKOUT TOKEN — mint the short-lived, server-signed create-order token
 * for guest checkout, from a CHECKOUT-LINK context only. This is the trusted
 * point that vouches "this buyer key belongs to this order": it never accepts a
 * raw order UUID, requires the order to belong to the given checkout link and be
 * payable, and binds the token to {orderId, buyerPublicKey, contractOrderId,
 * network}. It performs NO on-chain work — no create_order, no submit, never
 * marks paid — and fails closed when the server secret is absent.
 *
 * SEP-10 hardening: the caller must ALSO present a signed wallet-ownership
 * challenge (`issueCheckoutChallenge` → wallet signs → here) proving they
 * control `buyerPublicKey`. This closes the Phase 5.0 residual where a holder of
 * a valid (slug, order_no) pair could mint a token for an arbitrary buyer key
 * and force one operator-signed create_order (XLM-fee griefing). The proof is
 * verified BEFORE any store read, so an unproven caller learns nothing about
 * order existence. create_order and prepare still re-derive + verify amount and
 * on-chain state regardless of this token.
 */
export async function issueCheckoutToken(
  deps: PaymentDeps,
  input: IssueCheckoutTokenInput,
): Promise<IssueCheckoutTokenResult> {
  requireNetwork(deps, input.networkPassphrase);

  // Guest token issuance requires the server-only secret — fail closed.
  const secret = deps.config.checkoutTokenSecret;
  if (!secret) {
    throw new PaymentError(
      "CheckoutTokenUnavailable",
      "guest checkout token issuance is not configured",
    );
  }
  // Wallet-ownership proof secret — fail closed when unset (no unverified mint).
  const challengeSecret = deps.config.walletChallengeSecret;
  if (!challengeSecret) {
    throw new PaymentError(
      "WalletChallengeUnavailable",
      "checkout wallet-ownership proof is not configured",
    );
  }

  if (!isValidPublicKey(input.buyerPublicKey)) {
    throw new PaymentError("InvalidBuyerPublicKey", "invalid buyer public key");
  }

  // --- SEP-10 proof FIRST: (slug, order_no) possession alone never mints. ---
  // Verified before any DB read so an unproven caller gets no existence oracle.
  const nonce = verifyCheckoutChallengeToken(
    challengeSecret,
    input.challengeToken,
    {
      slug: input.slug,
      orderNo: input.orderNo,
      buyerPublicKey: input.buyerPublicKey,
      networkPassphrase: deps.config.networkPassphrase,
    },
  );
  if (!nonce) {
    throw new PaymentError(
      "Forbidden",
      "missing, expired, or invalid checkout challenge token",
    );
  }
  if (
    !verifyWalletChallengeTx({
      signedXdr: input.signedChallengeXdr,
      walletPublicKey: input.buyerPublicKey,
      networkPassphrase: deps.config.networkPassphrase,
      nonce,
    })
  ) {
    throw new PaymentError(
      "WrongBuyer",
      "the signature does not prove ownership of this wallet",
    );
  }

  const found = await deps.store.loadCheckoutOrderForIssuance({
    slug: input.slug,
    orderNo: input.orderNo,
  });
  // One generic not-found for any of {unknown slug, unknown order_no, order not
  // linked to that slug} — no existence oracle between those cases.
  if (!found) {
    throw new PaymentError(
      "CheckoutNotFound",
      "no matching checkout order for this link",
    );
  }

  // Checkout link must be active and unexpired.
  if (found.linkStatus !== "active") {
    throw new PaymentError(
      "CheckoutNotAvailable",
      "checkout link is not active",
    );
  }
  if (
    found.linkExpiresAt !== null &&
    Date.parse(found.linkExpiresAt) <= Date.now()
  ) {
    throw new PaymentError("CheckoutNotAvailable", "checkout link has expired");
  }
  // Order must still be awaiting payment (never issue for a paid/closed order).
  if (found.orderStatus !== "awaiting_payment") {
    throw new PaymentError(
      "OrderNotPayable",
      `order is not awaiting payment (status: ${found.orderStatus})`,
    );
  }

  const contractOrderId = contractOrderIdToHex(
    deriveContractOrderId(found.orderId),
  );
  const now = Date.now();
  const ttlMs = CHECKOUT_TOKEN_DEFAULT_TTL_MS;
  const checkoutToken = createCheckoutToken(
    secret,
    {
      orderId: found.orderId,
      buyerPublicKey: input.buyerPublicKey,
      contractOrderId,
      // Bind the SERVER network (already validated to match the request) so the
      // token's network claim is authoritative for the downstream create-order.
      networkPassphrase: deps.config.networkPassphrase,
    },
    now,
    ttlMs,
  );

  // TODO(audit): when an audit_events table exists, record a REDACTED issuance
  // event here (orderId, truncated buyer key, exp, network, client ip) for abuse
  // forensics. Never log the token or the full buyer key; no console logging of
  // PII/secrets is done here by design.

  return {
    checkoutToken,
    expiresAt: new Date(now + ttlMs).toISOString(),
    orderId: found.orderId,
    orderNo: found.orderNo,
    contractOrderId,
    networkPassphrase: deps.config.networkPassphrase,
    amountUsdc: found.totalUsdc,
  };
}

// ---------------------------------------------------------------------------
// ORDER CREATE FROM CHECKOUT LINK (Phase 6) — the public entry point that turns
// an active checkout link into an `awaiting_payment` order the rest of the
// pipeline (token → create_order → prepare → submit → sync) can operate on.
// ---------------------------------------------------------------------------

export interface CreateCheckoutOrderInput {
  /** Public checkout link slug (route param — never a link UUID). */
  slug: string;
  quantity: number;
  buyerEmail: string;
  buyerName: string;
  shippingAddress: {
    name: string;
    phone: string;
    addressLine1: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

export interface CreateCheckoutOrderResult {
  orderId: string;
  orderNo: string;
  status: "awaiting_payment";
  /** Server-derived total, DISPLAY ONLY — re-verified on-chain downstream. */
  totalUsdc: string;
}

/** Abuse guard: bounds total_usdc growth from a single request. */
export const MAX_CHECKOUT_ORDER_QUANTITY = 100;
const ORDER_NO_ATTEMPTS = 5;

// Crockford base32 (no I/L/O/U) — unambiguous in support conversations.
const ORDER_NO_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** High-entropy public order number: TRP- + 16 base32 chars (80 bits). The
 * (slug, order_no) pair later authorizes checkout-token issuance, so order_no
 * entropy is a security property, not just an id format. */
export function generateOrderNo(): string {
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += ORDER_NO_ALPHABET[bytes[i]! % 32];
  }
  return `TRP-${out}`;
}

/** Multiply a 2-decimal display reference price (IDR) by quantity without
 * float drift. Display-only — never an authority. */
function multiplyIdrReference(price: string, quantity: number): string {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(price.trim());
  if (!match) return price; // unexpected format — pass through, display only
  const cents =
    BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  const total = cents * BigInt(quantity);
  const intPart = total / 100n;
  const frac = (total % 100n).toString().padStart(2, "0");
  return frac === "00" ? `${intPart}` : `${intPart}.${frac}`;
}

/**
 * CREATE ORDER FROM CHECKOUT — validate an ACTIVE, unexpired checkout link and
 * insert a new `awaiting_payment` order for it. Price and seller are derived
 * strictly from the link (the client sends no amount/seller/status). Buyer
 * contact/shipping is stored on the order's single item row (metadata). Never
 * touches payment/escrow state and never marks anything paid.
 */
export async function createOrderFromCheckout(
  deps: PaymentDeps,
  input: CreateCheckoutOrderInput,
): Promise<CreateCheckoutOrderResult> {
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > MAX_CHECKOUT_ORDER_QUANTITY
  ) {
    throw new PaymentError(
      "InvalidInput",
      `quantity must be an integer between 1 and ${MAX_CHECKOUT_ORDER_QUANTITY}`,
    );
  }

  const link = await deps.store.loadCheckoutLinkBySlug(input.slug);
  if (!link) {
    throw new PaymentError("CheckoutNotFound", "checkout link not found");
  }
  if (link.status !== "active") {
    throw new PaymentError(
      "CheckoutNotAvailable",
      "checkout link is not active",
    );
  }
  if (link.expiresAt !== null && Date.parse(link.expiresAt) <= Date.now()) {
    throw new PaymentError("CheckoutNotAvailable", "checkout link has expired");
  }

  // Resolve the seller's payout wallet up front (server network, verified,
  // primary — fail closed). An order without seller_wallet_id can never pass
  // escrow creation, so refuse to create one at all.
  const sellerWalletId = await deps.store.resolveSellerWalletId({
    sellerProfileId: link.sellerProfileId,
    network: deps.config.networkName,
  });
  if (!sellerWalletId) {
    throw new PaymentError(
      "CheckoutNotAvailable",
      "seller has no valid payout wallet configured for this checkout",
    );
  }

  // Server-derived money, computed in integer units (no float math).
  const totalUnits = usdcToUnits(link.priceUsdc) * BigInt(input.quantity);
  const totalUsdc = unitsToUsdc(totalUnits);
  const totalIdrReference =
    link.priceIdrReference === null
      ? null
      : multiplyIdrReference(link.priceIdrReference, input.quantity);

  // Retry on the (astronomically unlikely) order_no unique collision.
  for (let attempt = 0; attempt < ORDER_NO_ATTEMPTS; attempt++) {
    const created = await deps.store.insertCheckoutOrder({
      orderNo: generateOrderNo(),
      checkoutLinkId: link.id,
      sellerProfileId: link.sellerProfileId,
      sellerWalletId,
      totalUsdc,
      totalIdrReference,
      item: {
        name: link.title,
        quantity: input.quantity,
        unitPriceUsdc: link.priceUsdc,
        subtotalUsdc: totalUsdc,
        metadata: {
          buyerEmail: input.buyerEmail,
          buyerName: input.buyerName,
          shippingAddress: input.shippingAddress,
        },
      },
    });
    if (created) {
      return {
        orderId: created.orderId,
        orderNo: created.orderNo,
        status: "awaiting_payment",
        totalUsdc,
      };
    }
  }
  throw new PaymentError(
    "Conflict",
    "could not allocate a unique order number; please retry",
  );
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
