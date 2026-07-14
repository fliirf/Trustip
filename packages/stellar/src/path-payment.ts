import {
  Asset,
  BASE_FEE,
  Horizon,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { currentNetwork, type NetworkConfig } from "@trustip/config";

// ---------------------------------------------------------------------------
// Seller USDC -> XLM conversion (strict-send path payment on the classic DEX).
//
// This is the EXECUTION of the XLM_WALLET payout route. After a direct release
// the USDC sits in the SELLER's own wallet — the operator can never move it —
// so this module only BUILDS an unsigned strict-send path payment the seller
// signs themselves, and submits what they signed. In-place conversion
// (destination = source), so the destination is guaranteed to exist on-chain
// (it just received the USDC) and no XLM trustline is needed (XLM is native).
//
// The operator signs NOTHING here. No custody, no contract change.
// ---------------------------------------------------------------------------

export interface UsdcToXlmQuote {
  /** USDC to send (the payout amount). */
  sendUsdc: string;
  /** Estimated XLM received via the best path. */
  estimatedXlm: string;
  /** Minimum XLM to receive (slippage floor); the tx fails below this. */
  destMinXlm: string;
  /** Unsigned transaction for the seller to sign in their wallet. */
  unsignedXdr: string;
}

// 1% default slippage floor on the estimate.
const DEFAULT_SLIPPAGE_BPS = 100;

function horizon(cfg: NetworkConfig): Horizon.Server {
  return new Horizon.Server(cfg.horizonUrl, {
    allowHttp: cfg.horizonUrl.startsWith("http://"),
  });
}

function usdc(cfg: NetworkConfig): Asset {
  return new Asset(cfg.usdcAssetCode, cfg.usdcIssuer);
}

/** Floor an amount by `bps` basis points, returned as a 7-dp string. bigint
 * stroop math so the floor is always <= the true value (conservative). */
export function applySlippageFloor(amount: string, bps: number): string {
  const stroops = BigInt(Math.round(Number(amount) * 1e7));
  const floored = (stroops * BigInt(10000 - bps)) / 10000n;
  const whole = floored / 10000000n;
  const frac = (floored % 10000000n).toString().padStart(7, "0");
  return `${whole}.${frac}`;
}

/**
 * Build an unsigned strict-send path payment converting `usdcAmount` USDC to XLM
 * IN PLACE (source = destination = `sourcePublicKey`). Returns the quote + XDR.
 * Throws when no path exists (no DEX liquidity) or the account is missing.
 */
export async function prepareUsdcToXlmConversion(input: {
  sourcePublicKey: string;
  usdcAmount: string;
  slippageBps?: number;
  cfg?: NetworkConfig;
}): Promise<UsdcToXlmQuote> {
  const cfg = input.cfg ?? currentNetwork;
  const server = horizon(cfg);
  const send = usdc(cfg);
  const dest = Asset.native();

  const paths = await server
    .strictSendPaths(send, input.usdcAmount, [dest])
    .call();
  const best = paths.records?.[0];
  if (!best) {
    throw new Error("no USDC->XLM path found (no DEX liquidity)");
  }
  const estimatedXlm = best.destination_amount;
  const destMinXlm = applySlippageFloor(
    estimatedXlm,
    input.slippageBps ?? DEFAULT_SLIPPAGE_BPS,
  );

  const path = (best.path ?? []).map((p) =>
    p.asset_type === "native"
      ? Asset.native()
      : new Asset(p.asset_code as string, p.asset_issuer as string),
  );

  const account = await server.loadAccount(input.sourcePublicKey);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: cfg.networkPassphrase,
  })
    .addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset: send,
        sendAmount: input.usdcAmount,
        destination: input.sourcePublicKey,
        destAsset: dest,
        destMin: destMinXlm,
        path,
      }),
    )
    .setTimeout(300)
    .build();

  return {
    sendUsdc: input.usdcAmount,
    estimatedXlm,
    destMinXlm,
    unsignedXdr: tx.toXDR(),
  };
}

/** Submit a seller-signed path-payment tx to the classic network. Returns the
 * confirmed hash + ledger, or throws with the Horizon failure. */
export async function submitPathPayment(
  signedXdr: string,
  cfg: NetworkConfig = currentNetwork,
): Promise<{ hash: string; ledger: number }> {
  const server = horizon(cfg);
  const tx = TransactionBuilder.fromXDR(signedXdr, cfg.networkPassphrase);
  const res = await server.submitTransaction(tx);
  return { hash: res.hash, ledger: res.ledger };
}

/** Source account of a (signed) tx XDR — for binding a submitted conversion to
 * the account it was prepared for. apps/web cannot import the SDK directly. */
export function transactionSource(
  signedXdr: string,
  cfg: NetworkConfig = currentNetwork,
): string {
  const tx = TransactionBuilder.fromXDR(signedXdr, cfg.networkPassphrase);
  // A fee-bump wraps the real tx; the conversion is never fee-bumped, but be safe.
  return "innerTransaction" in tx ? tx.innerTransaction.source : tx.source;
}

/** Injected DEX conversion gateway (keeps the SDK out of @trustip/payments). */
export interface PathPaymentGateway {
  prepareUsdcToXlmConversion(input: {
    sourcePublicKey: string;
    usdcAmount: string;
  }): Promise<UsdcToXlmQuote>;
  submitPathPayment(signedXdr: string): Promise<{ hash: string; ledger: number }>;
  transactionSource(signedXdr: string): string;
}

export function createPathPaymentGateway(
  cfg: NetworkConfig = currentNetwork,
): PathPaymentGateway {
  return {
    prepareUsdcToXlmConversion: (input) =>
      prepareUsdcToXlmConversion({ ...input, cfg }),
    submitPathPayment: (signedXdr) => submitPathPayment(signedXdr, cfg),
    transactionSource: (signedXdr) => transactionSource(signedXdr, cfg),
  };
}
