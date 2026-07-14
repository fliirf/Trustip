import type { AddPayoutMethodInput } from "@trustip/validators";
import { PaymentError } from "./errors.js";
import type { PaymentActor } from "./service.js";

// ---------------------------------------------------------------------------
// Seller payout methods (phase 10 — payout foundation).
//
// A payout method records WHERE/HOW a seller wants released funds routed. This
// module is CONFIG ONLY: it moves no money and touches no escrow/release path.
// The actual payout execution (direct USDC release, XLM path payment, MoneyGram
// cash-out) is the next layer (payout_requests) and is NOT built here.
//
// Security: USDC/XLM routes reference an already-VERIFIED seller wallet by id —
// a seller can never point a payout at an address they have not proven they own
// (that would be a fund-redirection vector). MoneyGram is a guided route that
// starts in `needs_review` (operational validation), carries no raw PII, and
// cannot execute until that layer exists.
// ---------------------------------------------------------------------------

export type PayoutMethodType = "usdc_wallet" | "xlm_wallet" | "moneygram_cashout";

export interface PayoutMethodRecord {
  id: string;
  methodType: PayoutMethodType;
  displayName: string;
  isDefault: boolean;
  status: string; // active | disabled | needs_review | unsupported_region
  stellarAddress: string | null;
  assetCode: string | null;
  cashoutCountry: string | null;
  cashoutCurrency: string | null;
  createdAt: string;
}

/** One payout in the seller's history. A direct (USDC-wallet) payout is the
 * escrow release itself, auto-recorded at release (record_direct_payout). */
export interface PayoutRecord {
  id: string;
  orderNo: string;
  routeType: string;
  status: string;
  releaseMode: string;
  amountUsdc: string | null;
  requestedAt: string | null;
  completedAt: string | null;
  /** The on-chain release tx for a direct payout (from its escrow_release
   * payout_transaction), or null for a not-yet-executed guided route. */
  releaseTxHash: string | null;
}

export interface PayoutTransactionRecord {
  transactionType: string;
  status: string;
  network: string;
  amountUsdc: string | null;
  txHash: string | null;
  createdAt: string;
}

export interface PayoutDetail extends PayoutRecord {
  transactions: PayoutTransactionRecord[];
}

export interface PayoutMethodStore {
  getSellerProfileIdForUser(userId: string): Promise<string | null>;

  /** The seller's payout history, newest first. */
  listPayouts(sellerProfileId: string): Promise<PayoutRecord[]>;

  /** One payout scoped to the seller (with its transactions), or null. */
  getPayout(input: {
    sellerProfileId: string;
    payoutId: string;
  }): Promise<PayoutDetail | null>;

  /** A wallet that this user OWNS and has VERIFIED (verified_at not null), by
   * id. Null when it does not exist, is not theirs, or is unverified. */
  findVerifiedWallet(input: {
    userId: string;
    walletId: string;
  }): Promise<{ publicKey: string } | null>;

  listPayoutMethods(sellerProfileId: string): Promise<PayoutMethodRecord[]>;

  insertPayoutMethod(input: {
    sellerProfileId: string;
    methodType: PayoutMethodType;
    displayName: string;
    status: "active" | "needs_review";
    walletId: string | null;
    stellarAddress: string | null;
    assetCode: string | null;
    cashoutCountry: string | null;
    cashoutCurrency: string | null;
  }): Promise<PayoutMethodRecord>;

  /** Clear the current default (if any) and set this one, scoped to the seller.
   * applied=false when the id is not an eligible (owned, non-disabled) method. */
  setDefaultPayoutMethod(input: {
    sellerProfileId: string;
    payoutMethodId: string;
  }): Promise<{ applied: boolean }>;

  /** Soft-disable (status='disabled'); clears default if it was the default.
   * applied=false when the id is not one of the seller's methods. */
  disablePayoutMethod(input: {
    sellerProfileId: string;
    payoutMethodId: string;
  }): Promise<{ applied: boolean }>;
}

export interface PayoutMethodDeps {
  store: PayoutMethodStore;
}

function requireUserId(actor: PaymentActor): string {
  if (!actor.userId) {
    throw new PaymentError("Forbidden", "authentication required");
  }
  return actor.userId;
}

async function requireSellerProfileId(
  deps: PayoutMethodDeps,
  actor: PaymentActor,
): Promise<string> {
  const userId = requireUserId(actor);
  const sellerProfileId = await deps.store.getSellerProfileIdForUser(userId);
  if (!sellerProfileId) {
    throw new PaymentError("SellerNotReady", "no seller profile");
  }
  return sellerProfileId;
}

export async function listPayoutMethods(
  deps: PayoutMethodDeps,
  actor: PaymentActor,
): Promise<PayoutMethodRecord[]> {
  const userId = requireUserId(actor);
  const sellerProfileId = await deps.store.getSellerProfileIdForUser(userId);
  if (!sellerProfileId) return []; // not onboarded yet — no methods, not an error
  return deps.store.listPayoutMethods(sellerProfileId);
}

export async function addPayoutMethod(
  deps: PayoutMethodDeps,
  actor: PaymentActor,
  input: AddPayoutMethodInput,
): Promise<PayoutMethodRecord> {
  const sellerProfileId = await requireSellerProfileId(deps, actor);
  const userId = actor.userId as string;

  let created: PayoutMethodRecord;
  if (input.methodType === "moneygram_cashout") {
    // Guided route: no wallet, starts needs_review until operationally validated.
    created = await deps.store.insertPayoutMethod({
      sellerProfileId,
      methodType: "moneygram_cashout",
      displayName: input.displayName,
      status: "needs_review",
      walletId: null,
      stellarAddress: null,
      assetCode: null,
      cashoutCountry: input.cashoutCountry,
      cashoutCurrency: input.cashoutCurrency,
    });
  } else {
    // usdc_wallet / xlm_wallet: the address MUST be a wallet the seller has
    // already proven they own (SEP-10 challenge in onboarding). This is what
    // stops a payout being pointed at someone else's address.
    const wallet = await deps.store.findVerifiedWallet({
      userId,
      walletId: input.walletId,
    });
    if (!wallet) {
      throw new PaymentError(
        "WalletNotFound",
        "payout wallet must be one of your verified wallets",
      );
    }
    created = await deps.store.insertPayoutMethod({
      sellerProfileId,
      methodType: input.methodType,
      displayName: input.displayName,
      status: "active",
      walletId: input.walletId,
      stellarAddress: wallet.publicKey,
      assetCode: input.methodType === "usdc_wallet" ? "USDC" : "XLM",
      cashoutCountry: null,
      cashoutCurrency: null,
    });
  }

  if (input.isDefault) {
    const { applied } = await deps.store.setDefaultPayoutMethod({
      sellerProfileId,
      payoutMethodId: created.id,
    });
    if (applied) created = { ...created, isDefault: true };
  }
  return created;
}

export async function setDefaultPayoutMethod(
  deps: PayoutMethodDeps,
  actor: PaymentActor,
  payoutMethodId: string,
): Promise<{ payoutMethodId: string; isDefault: true }> {
  const sellerProfileId = await requireSellerProfileId(deps, actor);
  const { applied } = await deps.store.setDefaultPayoutMethod({
    sellerProfileId,
    payoutMethodId,
  });
  if (!applied) {
    // Not the seller's method, or it is disabled (disabled can't be default).
    throw new PaymentError(
      "OrderNotEligible",
      "payout method not found or not eligible to be default",
    );
  }
  return { payoutMethodId, isDefault: true };
}

export async function listPayouts(
  deps: PayoutMethodDeps,
  actor: PaymentActor,
): Promise<PayoutRecord[]> {
  const userId = requireUserId(actor);
  const sellerProfileId = await deps.store.getSellerProfileIdForUser(userId);
  if (!sellerProfileId) return [];
  return deps.store.listPayouts(sellerProfileId);
}

export async function getPayout(
  deps: PayoutMethodDeps,
  actor: PaymentActor,
  payoutId: string,
): Promise<PayoutDetail> {
  const sellerProfileId = await requireSellerProfileId(deps, actor);
  const payout = await deps.store.getPayout({ sellerProfileId, payoutId });
  if (!payout) throw new PaymentError("OrderNotFound", "payout not found");
  return payout;
}

export async function disablePayoutMethod(
  deps: PayoutMethodDeps,
  actor: PaymentActor,
  payoutMethodId: string,
): Promise<{ payoutMethodId: string; status: "disabled" }> {
  const sellerProfileId = await requireSellerProfileId(deps, actor);
  const { applied } = await deps.store.disablePayoutMethod({
    sellerProfileId,
    payoutMethodId,
  });
  if (!applied) {
    throw new PaymentError("OrderNotFound", "payout method not found");
  }
  return { payoutMethodId, status: "disabled" };
}
