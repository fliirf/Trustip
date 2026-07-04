import {
  buildWalletChallengeTx,
  verifyWalletChallengeTx,
} from "@trustip/stellar";
import { PaymentError } from "./errors.js";
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
}

export interface SellerDeps {
  store: SellerStore;
  config: {
    networkName: NetworkName;
    networkPassphrase: string;
    /** Server-only HMAC secret for wallet challenges; unset = fail closed. */
    walletChallengeSecret?: string;
  };
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
