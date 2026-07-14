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

export interface ConversionContext {
  orderId: string;
  /** The wallet that received the release (source of the conversion). */
  sourcePublicKey: string | null;
  amountUsdc: string | null;
  routeType: string;
  status: string;
  /** Seller has an active xlm_wallet payout method (opted into XLM). */
  hasActiveXlmMethod: boolean;
  /** A convert request for this payout already exists. */
  alreadyConverted: boolean;
}

export interface ConversionStore {
  getSellerProfileIdForUser(userId: string): Promise<string | null>;
  loadConversionContext(input: {
    sellerProfileId: string;
    payoutId: string;
  }): Promise<ConversionContext | null>;
  recordXlmConversion(input: {
    sourcePayoutId: string;
    txHash: string;
    sendUsdc: string;
    recvXlm: string;
    network: NetworkName;
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

/** Load + guard the payout for conversion. Direct USDC payout, completed, with
 * an active XLM route, a known source wallet, and not already converted. */
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
  await requireSeller(deps, actor);

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
  try {
    signedSource = deps.gateway.transactionSource(input.signedXdr);
  } catch {
    throw new PaymentError("InvalidSignedTx", "could not decode the signed transaction");
  }
  if (signedSource !== input.sourcePublicKey) {
    throw new PaymentError(
      "WrongBuyer",
      "signed transaction source does not match the payout wallet",
    );
  }

  let result: { hash: string };
  try {
    result = await deps.gateway.submitPathPayment(input.signedXdr);
  } catch (e) {
    throw new PaymentError(
      "SubmitRejected",
      "the network rejected the conversion; please retry",
      e,
    );
  }

  await deps.store.recordXlmConversion({
    sourcePayoutId: input.payoutId,
    txHash: result.hash,
    sendUsdc: input.sendUsdc,
    recvXlm: input.estimatedXlm,
    network: deps.config.networkName,
  });

  return { payoutId: input.payoutId, txHash: result.hash };
}
