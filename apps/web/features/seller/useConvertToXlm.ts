"use client";

// Seller-signed USDC->XLM conversion state machine (XLM_WALLET route execution).
// The operator signs NOTHING: the released USDC lives in the seller's own wallet,
// so only the seller can move it. We ask the backend to build an UNSIGNED
// strict-send path payment bound to this payout, connect the seller's wallet
// (which MUST be the payout wallet — the source of the released funds), have it
// sign, and POST the signed tx. The backend re-checks the signed tx source
// against the payout wallet before submitting. One conversion per payout.

import {
  currentNetwork,
  getAvailableWallets,
  getWalletAdapter,
  signTransactionWithWallet,
  WalletError,
  type WalletAvailability,
  type WalletId,
} from "@trustip/stellar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ConversionQuote,
  prepareConversion,
  SellerApiError,
  submitConversion,
} from "./seller-api";

export type ConvertPhase =
  | "idle"
  | "preparing" // POSTing prepare (quote + binding token)
  | "ready" // have quote; awaiting wallet connect
  | "connecting"
  | "connected" // wallet connected AND matches the payout wallet
  | "awaiting-signature"
  | "submitting"
  | "done"
  | "failed";

export interface ConvertError {
  code: string;
  message: string;
}

function toConvertError(e: unknown): ConvertError {
  if (e instanceof SellerApiError || e instanceof WalletError) {
    return { code: e.code, message: e.message };
  }
  return {
    code: "InternalError",
    message: e instanceof Error ? e.message : String(e),
  };
}

export function useConvertToXlm(token: string | null) {
  const [activePayoutId, setActivePayoutId] = useState<string | null>(null);
  const [phase, setPhase] = useState<ConvertPhase>("idle");
  const [error, setError] = useState<ConvertError | null>(null);
  const [quote, setQuote] = useState<ConversionQuote | null>(null);
  const [wallets, setWallets] = useState<WalletAvailability[]>([]);
  const [walletId, setWalletId] = useState<WalletId | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const fail = useCallback((e: unknown, fallbackPhase: ConvertPhase) => {
    if (cancelled.current) return;
    setError(toConvertError(e));
    setPhase(fallbackPhase);
  }, []);

  const reset = useCallback(() => {
    setActivePayoutId(null);
    setPhase("idle");
    setError(null);
    setQuote(null);
    setWalletId(null);
    setPublicKey(null);
    setWrongNetwork(false);
    setTxHash(null);
  }, []);

  /** Open the convert flow for a payout: fetch the unsigned tx + binding token. */
  const start = useCallback(
    async (payoutId: string) => {
      if (!token) return;
      setActivePayoutId(payoutId);
      setError(null);
      setQuote(null);
      setWalletId(null);
      setPublicKey(null);
      setWrongNetwork(false);
      setTxHash(null);
      setPhase("preparing");
      try {
        const q = await prepareConversion(token, payoutId);
        if (cancelled.current) return;
        setQuote(q);
        try {
          setWallets(await getAvailableWallets());
        } catch {
          setWallets([]);
        }
        setPhase("ready");
      } catch (e) {
        fail(e, "failed");
      }
    },
    [token, fail],
  );

  const connect = useCallback(
    async (id: WalletId) => {
      if (!quote) return;
      setError(null);
      setWrongNetwork(false);
      setPhase("connecting");
      try {
        const adapter = getWalletAdapter(id);
        const pk = await adapter.connect();
        if (cancelled.current) return;
        // The signer MUST be the payout wallet — anything else can't move these
        // funds and the backend would reject the signed tx anyway.
        if (pk !== quote.sourcePublicKey) {
          fail(
            new SellerApiError(
              "WrongWallet",
              "connected wallet is not the payout wallet",
              403,
            ),
            "ready",
          );
          return;
        }
        let mismatch = false;
        try {
          const net = await adapter.getNetwork();
          mismatch = net.networkPassphrase !== currentNetwork.networkPassphrase;
        } catch {
          // wallet cannot report network — backend still fails closed
        }
        setWalletId(id);
        setPublicKey(pk);
        setWrongNetwork(mismatch);
        setPhase("connected");
      } catch (e) {
        fail(e, "ready");
      }
    },
    [quote, fail],
  );

  const submit = useCallback(async () => {
    if (!token || !quote || !walletId || !publicKey || !activePayoutId) return;
    setError(null);
    try {
      setPhase("awaiting-signature");
      const adapter = getWalletAdapter(walletId);
      const signedXdr = await signTransactionWithWallet(
        adapter,
        quote.unsignedXdr,
        {
          networkPassphrase: currentNetwork.networkPassphrase,
          address: publicKey,
        },
      );
      if (cancelled.current) return;
      setPhase("submitting");
      const res = await submitConversion(token, activePayoutId, {
        signedXdr,
        convertToken: quote.convertToken,
        sourcePublicKey: quote.sourcePublicKey,
        sendUsdc: quote.sendUsdc,
        estimatedXlm: quote.estimatedXlm,
      });
      if (cancelled.current) return;
      setTxHash(res.txHash);
      setPhase("done");
    } catch (e) {
      fail(e, "connected");
    }
  }, [token, quote, walletId, publicKey, activePayoutId, fail]);

  return {
    activePayoutId,
    phase,
    error,
    quote,
    wallets,
    walletId,
    publicKey,
    wrongNetwork,
    txHash,
    start,
    connect,
    submit,
    reset,
  };
}
