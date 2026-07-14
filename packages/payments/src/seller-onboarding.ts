import {
  buildWalletChallengeTx,
  verifyWalletChallengeTx,
} from "@trustip/stellar";
import { randomBytes } from "node:crypto";
import type { ShipmentUpdateStatus } from "@trustip/validators";
import { PaymentError } from "./errors.js";
import { unitsToUsdc, usdcToUnits } from "./money.js";
import type { NetworkName } from "./ports.js";
import type { PaymentActor } from "./service.js";
import {
  createWalletChallengeToken,
  generateChallengeNonce,
  verifyWalletChallengeToken,
  WALLET_CHALLENGE_DEFAULT_TTL_MS,
} from "./wallet-challenge-token.js";

// ---------------------------------------------------------------------------
// Seller onboarding (Phase 7B-1). Server-side only: every write goes through
// the service-role store — authenticated clients hold NO table DML grants, so
// `verified_at`, `is_primary`, and role scoping can never be forged from the
// browser. The wallet-ownership proof is a real signature check (SEP-10's core
// mechanism) — verified_at is set exclusively after it passes.
// ---------------------------------------------------------------------------

export type SellerWalletProvider = "freighter" | "xbull";

export interface SellerProfileRecord {
  id: string;
  userId: string;
  storeName: string;
  category: string | null;
  socialUrl: string | null;
}

/** Fulfillment-facing buyer contact summary (stored by checkout order-create
 * in order_items.metadata precisely for this purpose). */
export interface SellerOrderBuyerSummary {
  name: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
}

/** Buyer-facing public order status (STATUS-1A). Safe fields only — no
 * internal UUIDs, no tokens, no seller wallets, no other orders. */
/** The only order statuses a shipment update may move FROM. */
export type ShipmentTransitionFrom = "escrow_locked" | "processing" | "packed";

/** What the shipment guard needs to know about one seller-owned order. */
export interface ShipmentOrderContext {
  orderId: string;
  orderNo: string;
  status: string;
  escrowStatus: string | null;
  /** False for a no-shipping (digital goods) order — the only legal seller
   * transition is a direct escrow_locked -> delivered. */
  requiresShipping: boolean;
}

/** Read-only shipment view (Phase 8A). Safe fulfillment metadata only. */
export interface ShipmentSummary {
  status: string;
  courier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
}

export interface PublicOrderStatusRecord {
  orderNo: string;
  status: string;
  totalUsdc: string;
  quantity: number | null;
  createdAt: string;
  /** Set only once the order has actually completed (buyer-confirmed release);
   * null otherwise — never inferred ahead of backend truth. */
  completedAt: string | null;
  link: { title: string; description: string | null; slug: string };
  storeName: string | null;
  buyer: SellerOrderBuyerSummary | null;
  payment: { status: string; txHash: string | null } | null;
  /** Read-only escrow projection. `releaseTxHash` is null until the escrow is
   * actually released on-chain (buyer-confirmed release) — safe proof only. */
  escrow: {
    status: string;
    fundedTxHash: string | null;
    releaseTxHash: string | null;
  } | null;
  /** Real shipment progress only — null until the seller records it. */
  shipment: ShipmentSummary | null;
  /** False for a no-shipping (digital goods) order — the buyer/seller UI
   * skips the processing/packed/shipped lifecycle entirely. */
  requiresShipping: boolean;
  /** Latest refund request, if any — read-only projection so the buyer page
   * can show "refund diajukan / ditolak / dikembalikan" and hide
   * confirm-received while one is open. Safe public fields only. */
  refund: {
    status: string;
    reasonCode: string;
    createdAt: string;
    resolvedAt: string | null;
  } | null;
}

export interface SellerOrderRecord {
  orderId: string;
  orderNo: string;
  status: string;
  totalUsdc: string;
  quantity: number | null;
  createdAt: string;
  /** Set only once the order has actually completed (buyer-confirmed release). */
  completedAt: string | null;
  link: { title: string; slug: string } | null;
  buyer: SellerOrderBuyerSummary | null;
  payment: { status: string; txHash: string | null } | null;
  /** `releaseTxHash` is null until the escrow is actually released on-chain —
   * safe proof only, never shown as complete before the backend confirms it. */
  escrow: {
    status: string;
    fundedTxHash: string | null;
    releaseTxHash: string | null;
  } | null;
  shipment: ShipmentSummary | null;
  requiresShipping: boolean;
}

/** Extract the fulfillment contact from order_items.metadata, tolerating any
 * missing/partial/garbage shape (metadata is jsonb). Only the fields the
 * seller needs to ship — never anything else from metadata. */
export function toBuyerSummary(
  metadata: unknown,
): SellerOrderBuyerSummary | null {
  if (typeof metadata !== "object" || metadata === null) return null;
  const m = metadata as Record<string, unknown>;
  const addr =
    typeof m.shippingAddress === "object" && m.shippingAddress !== null
      ? (m.shippingAddress as Record<string, unknown>)
      : {};
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;
  const summary: SellerOrderBuyerSummary = {
    name: str(m.buyerName) ?? str(addr.name),
    email: str(m.buyerEmail),
    phone: str(addr.phone),
    addressLine1: str(addr.addressLine1),
    city: str(addr.city),
    postalCode: str(addr.postalCode),
    country: str(addr.country),
  };
  return Object.values(summary).every((v) => v === null) ? null : summary;
}

export interface SellerCheckoutLinkRecord {
  id: string;
  sellerProfileId: string;
  slug: string;
  title: string;
  description: string | null;
  priceUsdc: string;
  status: string;
  createdAt: string;
  requiresShipping: boolean;
}

export interface SellerWalletRecord {
  id: string;
  userId: string;
  walletProvider: SellerWalletProvider;
  publicKey: string;
  network: NetworkName;
  isPrimary: boolean;
  verifiedAt: string | null;
}

/** Narrow storage port for seller onboarding (service-role adapter; in-memory
 * fake in tests). Deliberately separate from PaymentStore — different domain,
 * and PaymentStore fakes should not grow seller methods. */
export interface SellerStore {
  /** Idempotently ensure the public.users row exists for an auth user (there
   * is no auth.users trigger). Never downgrades/overwrites an existing row. */
  ensureUserRow(input: { userId: string; email: string | null }): Promise<void>;
  getSellerProfile(userId: string): Promise<SellerProfileRecord | null>;
  upsertSellerProfile(input: {
    userId: string;
    storeName: string;
    category: string | null;
    socialUrl: string | null;
  }): Promise<SellerProfileRecord>;
  listWallets(userId: string): Promise<SellerWalletRecord[]>;
  findWallet(input: {
    userId: string;
    publicKey: string;
    network: NetworkName;
  }): Promise<SellerWalletRecord | null>;
  findWalletById(input: {
    userId: string;
    walletId: string;
  }): Promise<SellerWalletRecord | null>;
  /** Insert with verified_at = null. Returns the existing row unchanged when
   * (user, publicKey, network) is already registered (idempotent). */
  insertWallet(input: {
    userId: string;
    walletProvider: SellerWalletProvider;
    publicKey: string;
    network: NetworkName;
  }): Promise<SellerWalletRecord>;
  setWalletVerified(input: {
    walletId: string;
    verifiedAt: string;
  }): Promise<void>;
  /** Demote every primary wallet of the user on the network except one. */
  clearPrimary(input: {
    userId: string;
    network: NetworkName;
    exceptWalletId: string;
  }): Promise<void>;
  /** Promote a wallet to primary. Returns conflict=true when the partial
   * unique index rejects it (concurrent promotion) — caller maps to Conflict. */
  setPrimary(input: { walletId: string }): Promise<{ conflict: boolean }>;

  /** Checkout links owned by a seller profile, newest first. */
  listCheckoutLinks(
    sellerProfileId: string,
  ): Promise<SellerCheckoutLinkRecord[]>;
  /** Insert an ACTIVE checkout link. Returns null on a slug collision (unique
   * violation) so the caller can retry (generated) or reject (custom). */
  insertCheckoutLink(input: {
    sellerProfileId: string;
    slug: string;
    title: string;
    description: string | null;
    priceUsdc: string;
    requiresShipping: boolean;
  }): Promise<SellerCheckoutLinkRecord | null>;

  /** READ-ONLY: orders belonging to a seller profile, newest first, with safe
   * seller-facing joins only (link title/slug, payment/escrow status + tx
   * hashes, item quantity + fulfillment contact). Never tokens/secrets. */
  listSellerOrders(sellerProfileId: string): Promise<SellerOrderRecord[]>;

  /** READ-ONLY PUBLIC: one order resolved strictly by (checkout slug,
   * order_no) — the same lookup discipline as token issuance, so a raw UUID or
   * an order_no from another link can never resolve. Returns null on any
   * mismatch (caller maps to a generic 404, no oracle). */
  getPublicOrderStatus(input: {
    slug: string;
    orderNo: string;
  }): Promise<PublicOrderStatusRecord | null>;

  /** One order STRICTLY scoped to the seller profile, with just the state the
   * shipment guard needs. Null for not-found AND not-owned (no oracle). */
  getSellerOrderForShipment(input: {
    sellerProfileId: string;
    orderNo: string;
  }): Promise<ShipmentOrderContext | null>;

  /** Apply a guarded lifecycle write: orders.status moves fromStatus→toStatus
   * with a CONDITIONAL update (applied=false when the row was no longer in
   * fromStatus — concurrent writer wins), then upsert the shipment row and
   * append an order_status_events audit row. Only shipment-safe columns are
   * touched — payment/escrow state is structurally out of reach. */
  applyShipmentUpdate(input: {
    orderId: string;
    fromStatus: ShipmentTransitionFrom;
    toStatus: ShipmentUpdateStatus;
    courier: string | null;
    trackingNumber: string | null;
    note: string | null;
    /** Server-set only when toStatus === "shipped". */
    shippedAt: string | null;
    actorUserId: string;
  }): Promise<{ applied: boolean; shipment: ShipmentSummary }>;
}

/** Whether a seller payout wallet can receive the configured USDC asset. */
export interface SellerPayoutReadiness {
  accountExists: boolean;
  usdcTrustline: boolean;
}

/** Chain readiness probe for a seller payout wallet — injected adapter (Horizon)
 * so the onboarding service stays chain-agnostic and tests can fake it. */
export interface PayoutWalletReadinessPort {
  check(publicKey: string): Promise<SellerPayoutReadiness>;
}

export interface SellerDeps {
  store: SellerStore;
  config: {
    networkName: NetworkName;
    networkPassphrase: string;
    /** Server-only HMAC secret for wallet challenges; unset = fail closed. */
    walletChallengeSecret?: string;
  };
  /** Probes whether the seller payout wallet can receive USDC on-chain. */
  payoutReadiness: PayoutWalletReadinessPort;
}

function requireUserId(actor: PaymentActor): string {
  if (!actor.userId) {
    throw new PaymentError("Forbidden", "authentication required");
  }
  return actor.userId;
}

function requireConfiguredNetwork(
  deps: SellerDeps,
  network: NetworkName,
): void {
  if (network !== deps.config.networkName) {
    throw new PaymentError(
      "WrongNetwork",
      `network must be ${deps.config.networkName}`,
    );
  }
}

// --- Profile -----------------------------------------------------------------

export interface SaveSellerProfileInput {
  storeName: string;
  category?: string;
  socialUrl?: string;
  /** Auth email, threaded by the route for the ensured users row. */
  email?: string | null;
}

export async function saveSellerProfile(
  deps: SellerDeps,
  actor: PaymentActor,
  input: SaveSellerProfileInput,
): Promise<SellerProfileRecord> {
  const userId = requireUserId(actor);
  await deps.store.ensureUserRow({ userId, email: input.email ?? null });
  return deps.store.upsertSellerProfile({
    userId,
    storeName: input.storeName,
    category: input.category ?? null,
    socialUrl: input.socialUrl ?? null,
  });
}

export interface SellerOnboardingStatus {
  profile: SellerProfileRecord | null;
  wallets: SellerWalletRecord[];
  /** True when a verified primary wallet exists on the configured network —
   * the exact condition checkout order-create resolves (Phase 6.1). */
  checkoutReady: boolean;
}

export async function getSellerOnboarding(
  deps: SellerDeps,
  actor: PaymentActor,
): Promise<SellerOnboardingStatus> {
  const userId = requireUserId(actor);
  const [profile, wallets] = await Promise.all([
    deps.store.getSellerProfile(userId),
    deps.store.listWallets(userId),
  ]);
  const checkoutReady =
    profile !== null &&
    wallets.some(
      (w) =>
        w.network === deps.config.networkName &&
        w.isPrimary &&
        w.verifiedAt !== null,
    );
  return { profile, wallets, checkoutReady };
}

// --- Wallet registration -------------------------------------------------------

export interface RegisterSellerWalletInput {
  walletProvider: SellerWalletProvider;
  publicKey: string;
  network: NetworkName;
}

/** Register a wallet for the authenticated user. verified_at starts (and
 * stays) null until the challenge proof passes — the input carries no
 * verification or primary flags by construction. */
export async function registerSellerWallet(
  deps: SellerDeps,
  actor: PaymentActor,
  input: RegisterSellerWalletInput,
): Promise<SellerWalletRecord> {
  const userId = requireUserId(actor);
  requireConfiguredNetwork(deps, input.network);
  const existing = await deps.store.findWallet({
    userId,
    publicKey: input.publicKey,
    network: input.network,
  });
  if (existing) return existing;
  return deps.store.insertWallet({
    userId,
    walletProvider: input.walletProvider,
    publicKey: input.publicKey,
    network: input.network,
  });
}

// --- Wallet ownership challenge -------------------------------------------------

export interface WalletChallengeResult {
  /** Unsigned challenge transaction for the wallet to sign. */
  challengeXdr: string;
  /** Server HMAC token binding {user, key, network, nonce, exp}. */
  challengeToken: string;
  expiresAt: string;
  networkPassphrase: string;
}

export async function issueWalletChallenge(
  deps: SellerDeps,
  actor: PaymentActor,
  input: { publicKey: string; network: NetworkName },
  now: number = Date.now(),
): Promise<WalletChallengeResult> {
  const userId = requireUserId(actor);
  requireConfiguredNetwork(deps, input.network);
  const secret = deps.config.walletChallengeSecret;
  if (!secret) {
    throw new PaymentError(
      "WalletChallengeUnavailable",
      "wallet verification is not configured on this server",
    );
  }
  const wallet = await deps.store.findWallet({
    userId,
    publicKey: input.publicKey,
    network: input.network,
  });
  if (!wallet) {
    throw new PaymentError("WalletNotFound", "wallet is not registered");
  }

  const nonce = generateChallengeNonce();
  const claims = {
    userId,
    walletPublicKey: input.publicKey,
    networkPassphrase: deps.config.networkPassphrase,
  };
  const challengeToken = createWalletChallengeToken(secret, claims, nonce, now);
  const challengeXdr = buildWalletChallengeTx({
    walletPublicKey: input.publicKey,
    networkPassphrase: deps.config.networkPassphrase,
    nonce,
  });
  return {
    challengeXdr,
    challengeToken,
    expiresAt: new Date(now + WALLET_CHALLENGE_DEFAULT_TTL_MS).toISOString(),
    networkPassphrase: deps.config.networkPassphrase,
  };
}

// --- Wallet ownership verification ----------------------------------------------

export interface VerifySellerWalletInput {
  publicKey: string;
  network: NetworkName;
  signedXdr: string;
  challengeToken: string;
}

/** Verify the signed challenge and ONLY then set verified_at (service role).
 * The token binds the authenticated user + key + network + nonce, and the
 * signature is checked against the wallet key over the network-bound tx hash —
 * no client claim is trusted anywhere in this path. */
export async function verifySellerWallet(
  deps: SellerDeps,
  actor: PaymentActor,
  input: VerifySellerWalletInput,
  now: number = Date.now(),
): Promise<SellerWalletRecord> {
  const userId = requireUserId(actor);
  requireConfiguredNetwork(deps, input.network);
  const secret = deps.config.walletChallengeSecret;
  if (!secret) {
    throw new PaymentError(
      "WalletChallengeUnavailable",
      "wallet verification is not configured on this server",
    );
  }
  const wallet = await deps.store.findWallet({
    userId,
    publicKey: input.publicKey,
    network: input.network,
  });
  if (!wallet) {
    throw new PaymentError("WalletNotFound", "wallet is not registered");
  }

  const nonce = verifyWalletChallengeToken(
    secret,
    input.challengeToken,
    {
      userId,
      walletPublicKey: input.publicKey,
      networkPassphrase: deps.config.networkPassphrase,
    },
    now,
  );
  if (
    !nonce ||
    !verifyWalletChallengeTx({
      signedXdr: input.signedXdr,
      walletPublicKey: input.publicKey,
      networkPassphrase: deps.config.networkPassphrase,
      nonce,
    })
  ) {
    // One generic message for expired/tampered/mis-signed — no oracle.
    throw new PaymentError(
      "InvalidInput",
      "wallet verification failed; request a new challenge and sign it with the registered wallet",
    );
  }

  if (!wallet.verifiedAt) {
    await deps.store.setWalletVerified({
      walletId: wallet.id,
      verifiedAt: new Date(now).toISOString(),
    });
  }
  return {
    ...wallet,
    verifiedAt: wallet.verifiedAt ?? new Date(now).toISOString(),
  };
}

// --- Primary wallet ---------------------------------------------------------------

/** Promote a VERIFIED wallet on the configured network to the user's single
 * primary for that network (demoting any others). The partial unique index
 * (user_id, network) WHERE is_primary is the structural backstop. */
export async function setPrimarySellerWallet(
  deps: SellerDeps,
  actor: PaymentActor,
  input: { walletId: string },
): Promise<SellerWalletRecord> {
  const userId = requireUserId(actor);
  const wallet = await deps.store.findWalletById({
    userId,
    walletId: input.walletId,
  });
  if (!wallet) {
    throw new PaymentError("WalletNotFound", "wallet is not registered");
  }
  requireConfiguredNetwork(deps, wallet.network);
  if (!wallet.verifiedAt) {
    throw new PaymentError(
      "Conflict",
      "wallet must be verified before it can become the primary payout wallet",
    );
  }

  await deps.store.clearPrimary({
    userId,
    network: wallet.network,
    exceptWalletId: wallet.id,
  });
  const { conflict } = await deps.store.setPrimary({ walletId: wallet.id });
  if (conflict) {
    throw new PaymentError(
      "Conflict",
      "another primary wallet was set concurrently; retry",
    );
  }
  return { ...wallet, isPrimary: true };
}

// --- Checkout links (Phase 7C) -----------------------------------------------

// Lowercase Crockford base32 — URL-safe, unambiguous, matches checkoutSlugSchema.
const SLUG_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const SLUG_LENGTH = 12;
const SLUG_ATTEMPTS = 5;

/** Server-generated public slug (~60 bits). Slugs are public identifiers, not
 * secrets — entropy here is only for collision avoidance. */
export function generateCheckoutSlug(): string {
  const bytes = randomBytes(SLUG_LENGTH);
  let out = "";
  for (let i = 0; i < SLUG_LENGTH; i++) {
    out += SLUG_ALPHABET[bytes[i]! % 32];
  }
  return out;
}

/** Require the seller to be fully checkout-ready (profile + verified primary
 * wallet on the configured network) — the exact condition order creation
 * resolves. Fails closed so no link can exist that immediately 409s buyers. */
async function requireCheckoutReadyProfile(
  deps: SellerDeps,
  actor: PaymentActor,
): Promise<SellerProfileRecord> {
  const status = await getSellerOnboarding(deps, actor);
  if (!status.profile || !status.checkoutReady) {
    throw new PaymentError(
      "SellerNotReady",
      "complete seller onboarding (profile + verified primary wallet) before creating checkout links",
    );
  }

  // The verified primary payout wallet on the configured network. checkoutReady
  // guarantees one exists; find it to probe on-chain USDC readiness.
  const wallet = status.wallets.find(
    (w) =>
      w.network === deps.config.networkName &&
      w.isPrimary &&
      w.verifiedAt !== null,
  );
  if (!wallet) {
    throw new PaymentError(
      "SellerNotReady",
      "complete seller onboarding (profile + verified primary wallet) before creating checkout links",
    );
  }

  // A verified wallet only proves ownership — it does NOT mean the wallet can
  // RECEIVE USDC. Block links whose payout wallet can't receive the asset, so
  // no order can ever fund against an undeliverable payout (release would then
  // fail closed on-chain). Chain-probe failures never leak and never create a
  // possibly-undeliverable link — the seller is asked to retry.
  let readiness: SellerPayoutReadiness;
  try {
    readiness = await deps.payoutReadiness.check(wallet.publicKey);
  } catch (cause) {
    throw new PaymentError(
      "RpcFailure",
      "could not verify payout wallet readiness; please retry",
      cause,
    );
  }
  if (!readiness.accountExists || !readiness.usdcTrustline) {
    throw new PaymentError(
      "SellerPayoutWalletNotReady",
      "seller payout wallet cannot receive USDC on this network; add a USDC trustline and retry",
    );
  }
  return status.profile;
}

/** READ-ONLY PUBLIC order status (STATUS-1A). Lookup is authorized purely by
 * possession of the high-entropy order_no scoped to its checkout slug; every
 * miss is the same generic CheckoutNotFound (no existence oracle). Never
 * mutates anything, never lists. */
export async function getPublicOrderStatus(
  deps: SellerDeps,
  input: { slug: string; orderNo: string },
): Promise<PublicOrderStatusRecord> {
  const record = await deps.store.getPublicOrderStatus(input);
  if (!record) {
    throw new PaymentError("CheckoutNotFound", "order not found");
  }
  return record;
}

/** READ-ONLY seller orders (Phase 7D). No mutation of any lifecycle state —
 * shipment/release/refund actions are later phases. Sellers without a profile
 * get a safe empty list (no existence oracle, nothing to leak). */
export async function listSellerOrders(
  deps: SellerDeps,
  actor: PaymentActor,
): Promise<SellerOrderRecord[]> {
  const userId = requireUserId(actor);
  const profile = await deps.store.getSellerProfile(userId);
  if (!profile) return [];
  return deps.store.listSellerOrders(profile.id);
}

export async function listSellerCheckoutLinks(
  deps: SellerDeps,
  actor: PaymentActor,
): Promise<SellerCheckoutLinkRecord[]> {
  const userId = requireUserId(actor);
  const profile = await deps.store.getSellerProfile(userId);
  if (!profile) return [];
  return deps.store.listCheckoutLinks(profile.id);
}

export interface CreateSellerCheckoutLinkInput {
  title: string;
  description?: string;
  /** Unit price as a decimal USDC string (validated server-side). */
  priceUsdc: string;
  /** Optional custom slug (strictly validated); omitted = server-generated. */
  slug?: string;
  /** False for digital goods with no physical delivery. Defaults true. */
  requiresShipping?: boolean;
}

export async function createSellerCheckoutLink(
  deps: SellerDeps,
  actor: PaymentActor,
  input: CreateSellerCheckoutLinkInput,
): Promise<SellerCheckoutLinkRecord> {
  const profile = await requireCheckoutReadyProfile(deps, actor);

  // Money discipline: parse via integer units; reject zero/negative/malformed.
  let units: bigint;
  try {
    units = usdcToUnits(input.priceUsdc);
  } catch {
    throw new PaymentError("InvalidInput", "invalid USDC price");
  }
  if (units <= 0n) {
    throw new PaymentError("InvalidInput", "price must be greater than zero");
  }
  const priceUsdc = unitsToUsdc(units);

  const customSlug = input.slug?.toLowerCase();
  const attempts = customSlug ? 1 : SLUG_ATTEMPTS;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const created = await deps.store.insertCheckoutLink({
      sellerProfileId: profile.id,
      slug: customSlug ?? generateCheckoutSlug(),
      title: input.title,
      description: input.description ?? null,
      priceUsdc,
      requiresShipping: input.requiresShipping ?? true,
    });
    if (created) return created;
  }
  throw new PaymentError(
    "Conflict",
    customSlug
      ? "that slug is already taken; choose another"
      : "could not allocate a unique link slug; please retry",
  );
}

// --- Shipment lifecycle (Phase 8A) --------------------------------------------

/** Strict single-step forward transitions. Keys are the REQUIRED current
 * orders.status for each seller-settable target. Everything else — backward
 * moves, skips, terminal/refund states, pre-funding states — is rejected.
 * `delivered` is a direct target ONLY for a no-shipping order (guarded below,
 * not by this map) — `completed`/release stay backend-only (buyer-confirmed). */
export const SHIPMENT_TRANSITION_FROM: Record<
  ShipmentUpdateStatus,
  ShipmentTransitionFrom
> = {
  processing: "escrow_locked",
  packed: "processing",
  shipped: "packed",
  delivered: "escrow_locked",
};

export interface UpdateSellerShipmentInput {
  orderNo: string;
  status: ShipmentUpdateStatus;
  courier?: string;
  trackingNumber?: string;
  note?: string;
}

export interface SellerShipmentResult {
  orderNo: string;
  orderStatus: string;
  shipment: ShipmentSummary;
  updatedAt: string;
}

/**
 * Seller-controlled fulfillment write path — the ONLY lifecycle mutation a
 * seller has. Scope: own orders only (profile derived from the authenticated
 * user, never client input). Precondition: escrow funded. Legality: strict
 * single-step forward transitions. This function cannot touch payment or
 * escrow state at all — the store method only writes orders.status (guarded),
 * the shipments row, and an audit event.
 */
export async function updateSellerShipment(
  deps: SellerDeps,
  actor: PaymentActor,
  input: UpdateSellerShipmentInput,
  now: number = Date.now(),
): Promise<SellerShipmentResult> {
  const userId = requireUserId(actor);
  const profile = await deps.store.getSellerProfile(userId);
  // No profile, not owned, or no such order — one generic 404, no oracle.
  const order = profile
    ? await deps.store.getSellerOrderForShipment({
        sellerProfileId: profile.id,
        orderNo: input.orderNo,
      })
    : null;
  if (!order) {
    throw new PaymentError("OrderNotFound", "order not found");
  }

  if (order.escrowStatus !== "funded") {
    throw new PaymentError(
      "Conflict",
      "shipment updates are only allowed after the escrow is funded",
    );
  }
  const requiredFrom = SHIPMENT_TRANSITION_FROM[input.status];
  if (order.status !== requiredFrom) {
    throw new PaymentError(
      "Conflict",
      `cannot move order from '${order.status}' to '${input.status}'`,
    );
  }
  // `delivered` is the ONLY legal target for a no-shipping order, and is
  // illegal for one that requires shipping (that path goes through
  // shipped, then the buyer-confirmed release records delivery itself).
  if (input.status === "delivered" && order.requiresShipping) {
    throw new PaymentError(
      "Conflict",
      "this order requires shipping; use processing/packed/shipped instead",
    );
  }
  if (input.status !== "delivered" && !order.requiresShipping) {
    throw new PaymentError(
      "Conflict",
      "this order does not require shipping; mark it delivered directly",
    );
  }

  const courier = input.courier ?? null;
  const trackingNumber = input.trackingNumber ?? null;
  if (input.status === "shipped" && (!courier || !trackingNumber)) {
    throw new PaymentError(
      "InvalidInput",
      "courier and trackingNumber are required to mark an order shipped",
    );
  }

  const nowIso = new Date(now).toISOString();
  const { applied, shipment } = await deps.store.applyShipmentUpdate({
    orderId: order.orderId,
    fromStatus: requiredFrom,
    toStatus: input.status,
    courier,
    trackingNumber,
    note: input.note ?? null,
    shippedAt: input.status === "shipped" ? nowIso : null,
    actorUserId: userId,
  });
  if (!applied) {
    throw new PaymentError(
      "Conflict",
      "order status changed concurrently; reload and retry",
    );
  }

  return {
    orderNo: order.orderNo,
    orderStatus: input.status,
    shipment,
    updatedAt: nowIso,
  };
}
