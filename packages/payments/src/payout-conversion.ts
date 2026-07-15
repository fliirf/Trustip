import type { PathPaymentGateway } from "@trustip/stellar";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PaymentError } from "./errors.js";
import type { NetworkName } from "./ports.js";
import type { PaymentActor } from "./service.js";

// ---------------------------------------------------------------------------
// XLM_WALLET payout route execution — seller-signed USDC -> XLM conversion.
//
// The released USDC lives in the seller's OWN wallet, so only the seller can
// convert it. Flow (mirrors buyer confirm-received): prepare builds an unsigned
// strict-send path payment + a short-lived binding token; the seller signs in
// their wallet; submit verifies the token, checks the signed tx's source, and
// submits it, then records the conversion (record_xlm_conversion RPC). The
// operator signs nothing and never holds the funds.
// ---------------------------------------------------------------------------

const CONVERT_TOKEN_TTL_MS = 5 * 60 * 1000;

interface ConvertClaims {
  payoutId: string;
  sourcePublicKey: string;
  sendUsdc: string;
  estimatedXlm: string;
}

function payload(c: ConvertClaims, exp: number): string {
  return [
    "xlm-convert:v1",
    c.payoutId,
    c.sourcePublicKey,
    c.sendUsdc,
    c.estimatedXlm,
    exp,
  ].join(":");
}

function createConvertToken(
  secret: string,
  c: ConvertClaims,
  now = Date.now(),
): string {
  const exp = now + CONVERT_TOKEN_TTL_MS;
  const sig = createHmac("sha256", secret).update(payload(c, exp)).digest("hex");
  return `${exp}.${sig}`;
}

function verifyConvertToken(
  secret: string,
  token: string,
  c: ConvertClaims,
  now = Date.now(),
): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [expStr, sig] = parts as [string, string];
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now) return false;
  const expected = createHmac("sha256", secret)
    .update(payload(c, exp))
    .digest("hex");
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/** A conversion recorded as submitted but not yet confirmed (Horizon timeout /
 * crash between submit and confirm). Resolved against the chain on the next
 * prepare — never silently ignored, so a retry can never double-convert. */
export interface PendingConversion {
  txHash: string | null;
  sendUsdc: string | null;
  recvXlm: string | null;
  createdAt: string | null;
}

export interface ConversionContext {
  orderId: string;
  /** The wallet that received the release (source of the conversion). */
  sourcePublicKey: string | null;
  amountUsdc: string | null;
  routeType: string;
  status: string;
  /** Seller has an active xlm_wallet payout method (opted into XLM). */
  hasActiveXlmMethod: boolean;
  /** A COMPLETED convert request for this payout already exists. */
  alreadyConverted: boolean;
  /** A submitted-but-unconfirmed convert request, if any. */
  pendingConversion: PendingConversion | null;
}

export interface ConversionStore {
  getSellerProfileIdForUser(userId: string): Promise<string | null>;
  loadConversionContext(input: {
    sellerProfileId: string;
    payoutId: string;
  }): Promise<ConversionContext | null>;
  /** Record the conversion. `submitted` is written BEFORE the Horizon submit
   * (heal-able pending state); `confirmed` upgrades it with chain-actual XLM. */
  recordXlmConversion(input: {
    sourcePayoutId: string;
    txHash: string;
    sendUsdc: string;
    recvXlm: string;
    network: NetworkName;
    status: "submitted" | "confirmed";
  }): Promise<void>;
  /** Mark a pending conversion failed (its tx failed on-chain or can no longer
   * land), unblocking a fresh prepare. No-op unless still pending. */
  failStaleConversion(input: {
    sourcePayoutId: string;
    txHash: string | null;
  }): Promise<void>;
}

export interface ConversionDeps {
  store: ConversionStore;
  gateway: PathPaymentGateway;
  config: {
    networkName: NetworkName;
    /** HMAC secret for the convert binding token. Unset = fail closed. */
    walletChallengeSecret?: string;
  };
}

async function requireSeller(
  deps: ConversionDeps,
  actor: PaymentActor,
): Promise<string> {
  if (!actor.userId) throw new PaymentError("Forbidden", "authentication required");
  const id = await deps.store.getSellerProfileIdForUser(actor.userId);
  if (!id) throw new PaymentError("SellerNotReady", "no seller profile");
  return id;
}

/** Max age of an unfound pending tx before it is considered dead. The unsigned
 * tx carries 5-minute timebounds; past this it can never land. */
const PENDING_EXPIRY_MS = 10 * 60 * 1000;

/** Load + guard the payout for conversion. Direct USDC payout, completed, with
 * an active XLM route, a known source wallet, and not already converted.
 * Pending (submitted-but-unconfirmed) handling is the caller's job. */
async function loadEligible(
  deps: ConversionDeps,
  sellerProfileId: string,
  payoutId: string,
): Promise<ConversionContext & { sourcePublicKey: string; amountUsdc: string }> {
  const ctx = await deps.store.loadConversionContext({ sellerProfileId, payoutId });
  if (!ctx) throw new PaymentError("OrderNotFound", "payout not found");
  if (ctx.routeType !== "usdc_wallet" || ctx.status !== "completed") {
    throw new PaymentError("OrderNotEligible", "payout is not a completed direct payout");
  }
  if (!ctx.hasActiveXlmMethod) {
    throw new PaymentError("Conflict", "add an active XLM payout method first");
  }
  if (ctx.alreadyConverted) {
    throw new PaymentError("Conflict", "this payout was already converted to XLM");
  }
  if (!ctx.sourcePublicKey || !ctx.amountUsdc) {
    throw new PaymentError("Conflict", "payout is missing its release wallet or amount");
  }
  return { ...ctx, sourcePublicKey: ctx.sourcePublicKey, amountUsdc: ctx.amountUsdc };
}

/** Resolve a pending (submitted-but-unconfirmed) conversion against the chain.
 * Confirmed → upgrade the record and report already-converted; failed or
 * expired → mark failed (a fresh prepare may proceed); still in flight →
 * Conflict, retry shortly. Never allows a second tx while one can still land. */
async function resolvePendingConversion(
  deps: ConversionDeps,
  payoutId: string,
  ctx: ConversionContext & { amountUsdc: string },
  now: number = Date.now(),
): Promise<void> {
  const pending = ctx.pendingConversion;
  if (!pending) return;

  const status = pending.txHash
    ? await deps.gateway.getTransactionStatus(pending.txHash)
    : "failed"; // a pending row without a hash can never be confirmed
  if (status === "confirmed") {
    await deps.store.recordXlmConversion({
      sourcePayoutId: payoutId,
      txHash: pending.txHash!,
      sendUsdc: pending.sendUsdc ?? ctx.amountUsdc,
      recvXlm: pending.recvXlm ?? "0",
      network: deps.config.networkName,
      status: "confirmed",
    });
    throw new PaymentError("Conflict", "this payout was already converted to XLM");
  }
  const age = pending.createdAt ? now - Date.parse(pending.createdAt) : Infinity;
  if (status === "failed" || age > PENDING_EXPIRY_MS) {
    await deps.store.failStaleConversion({
      sourcePayoutId: payoutId,
      txHash: pending.txHash,
    });
    return; // dead tx — a fresh conversion may proceed
  }
  throw new PaymentError(
    "Conflict",
    "a conversion for this payout is still confirming; retry shortly",
  );
}

export interface PrepareConversionResult {
  unsignedXdr: string;
  sourcePublicKey: string;
  sendUsdc: string;
  estimatedXlm: string;
  destMinXlm: string;
  convertToken: string;
}

export async function prepareXlmConversion(
  deps: ConversionDeps,
  actor: PaymentActor,
  payoutId: string,
): Promise<PrepareConversionResult> {
  const secret = deps.config.walletChallengeSecret;
  if (!secret) {
    throw new PaymentError(
      "WalletChallengeUnavailable",
      "conversion is not configured",
    );
  }
  const sellerProfileId = await requireSeller(deps, actor);
  const ctx = await loadEligible(deps, sellerProfileId, payoutId);
  await resolvePendingConversion(deps, payoutId, ctx);

  const quote = await deps.gateway.prepareUsdcToXlmConversion({
    sourcePublicKey: ctx.sourcePublicKey,
    usdcAmount: ctx.amountUsdc,
  });

  const convertToken = createConvertToken(secret, {
    payoutId,
    sourcePublicKey: ctx.sourcePublicKey,
    sendUsdc: quote.sendUsdc,
    estimatedXlm: quote.estimatedXlm,
  });

  return {
    unsignedXdr: quote.unsignedXdr,
    sourcePublicKey: ctx.sourcePublicKey,
    sendUsdc: quote.sendUsdc,
    estimatedXlm: quote.estimatedXlm,
    destMinXlm: quote.destMinXlm,
    convertToken,
  };
}

export interface SubmitConversionInput {
  payoutId: string;
  signedXdr: string;
  convertToken: string;
  /** Echoed back from prepare so the token can be re-verified. */
  sourcePublicKey: string;
  sendUsdc: string;
  estimatedXlm: string;
}

export async function submitXlmConversion(
  deps: ConversionDeps,
  actor: PaymentActor,
  input: SubmitConversionInput,
): Promise<{ payoutId: string; txHash: string }> {
  const secret = deps.config.walletChallengeSecret;
  if (!secret) {
    throw new PaymentError("WalletChallengeUnavailable", "conversion is not configured");
  }
  const sellerProfileId = await requireSeller(deps, actor);

  const claims: ConvertClaims = {
    payoutId: input.payoutId,
    sourcePublicKey: input.sourcePublicKey,
    sendUsdc: input.sendUsdc,
    estimatedXlm: input.estimatedXlm,
  };
  if (!verifyConvertToken(secret, input.convertToken, claims)) {
    throw new PaymentError("Forbidden", "invalid or expired conversion token");
  }

  // The seller signs their OWN wallet's funds; still, bind the submitted tx to
  // the account the token authorized so a mismatched tx can't be recorded here.
  let signedSource: string;
  let txHash: string;
  try {
    signedSource = deps.gateway.transactionSource(input.signedXdr);
    txHash = deps.gateway.transactionHash(input.signedXdr);
  } catch {
    throw new PaymentError("InvalidSignedTx", "could not decode the signed transaction");
  }
  if (signedSource !== input.sourcePublicKey) {
    throw new PaymentError(
      "WrongBuyer",
      "signed transaction source does not match the payout wallet",
    );
  }

  // Re-check ownership + eligibility at submit time — the token alone is never
  // the whole authority. A pending row is only acceptable when it is THIS tx
  // (a retry of the same signed envelope).
  const ctx = await loadEligible(deps, sellerProfileId, input.payoutId);
  if (ctx.pendingConversion && ctx.pendingConversion.txHash !== txHash) {
    throw new PaymentError(
      "Conflict",
      "another conversion for this payout is still confirming",
    );
  }

  // Record SUBMITTED before touching Horizon, so a timeout while the tx can
  // still land (5-min timebounds) blocks any second conversion until resolved.
  await deps.store.recordXlmConversion({
    sourcePayoutId: input.payoutId,
    txHash,
    sendUsdc: input.sendUsdc,
    recvXlm: input.estimatedXlm,
    network: deps.config.networkName,
    status: "submitted",
  });

  let result: { hash: string; receivedXlm: string | null };
  try {
    result = await deps.gateway.submitPathPayment(input.signedXdr);
  } catch (e) {
    // The tx may have landed despite the error (e.g. Horizon timeout) — check
    // before failing so a landed conversion is confirmed, not retried.
    const landed = await deps.gateway
      .getTransactionStatus(txHash)
      .catch(() => "not_found" as const);
    if (landed !== "confirmed") {
      if (landed === "failed") {
        await deps.store.failStaleConversion({
          sourcePayoutId: input.payoutId,
          txHash,
        });
      }
      // not_found: leave the pending row — prepare resolves it once the
      // timebounds pass (or it confirms).
      throw new PaymentError(
        "SubmitRejected",
        "the network rejected the conversion; please retry",
        e,
      );
    }
    result = { hash: txHash, receivedXlm: null };
  }

  // Chain-actual received XLM when decodable; the estimate only as fallback.
  await deps.store.recordXlmConversion({
    sourcePayoutId: input.payoutId,
    txHash: result.hash,
    sendUsdc: input.sendUsdc,
    recvXlm: result.receivedXlm ?? input.estimatedXlm,
    network: deps.config.networkName,
    status: "confirmed",
  });

  return { payoutId: input.payoutId, txHash: result.hash };
}
