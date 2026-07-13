"use client";

// Buyer USDC top-up via a Stellar anchor's SEP-24 interactive deposit
// (Roadmap B). The buyer connects a wallet, authenticates to the anchor
// (SEP-10), starts an interactive deposit, completes it in the anchor-hosted
// tab, and we poll the anchor until the USDC lands in their wallet. Trustip
// never holds the funds or the anchor session — this is a pure on-ramp.

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
  AnchorApiError,
  fetchAnchorInfo,
  getAnchorChallenge,
  getAnchorTransaction,
  postAnchorToken,
  startInteractiveDeposit,
} from "./anchor-api";

const ANCHOR_DOMAIN =
  process.env.NEXT_PUBLIC_ANCHOR_DOMAIN ?? "testanchor.stellar.org";
const ASSET_CODE = "USDC";

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 120; // ~10 minutes

export type TopupPhase =
  | "idle"
  | "connecting"
  | "authenticating"
  | "starting"
  | "interactive"
  | "completed"
  | "failed";

/** SEP-24 statuses that end polling. */
const TERMINAL = new Set(["completed", "error", "refunded"]);

/** `message` is a sentinel code (see `anchor-api.ts`), a `depositStatus:<status>`
 * sentinel, or the external anchor's own error text passed through unchanged —
 * translated at the render site via `d.anchor.errors` (this hook has no
 * useDict access). */
export interface TopupError {
  message: string;
}

function toError(e: unknown): TopupError {
  if (e instanceof AnchorApiError || e instanceof WalletError) {
    return { message: e.message };
  }
  return { message: e instanceof Error ? e.message : String(e) };
}

export function useAnchorTopup() {
  const [phase, setPhase] = useState<TopupPhase>("idle");
  const [error, setError] = useState<TopupError | null>(null);
  const [wallets, setWallets] = useState<WalletAvailability[]>([]);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [amountOut, setAmountOut] = useState<string | null>(null);
  const [interactiveUrl, setInteractiveUrl] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const detectWallets = useCallback(async () => {
    try {
      setWallets(await getAvailableWallets());
    } catch {
      setWallets([]);
    }
  }, []);

  const start = useCallback(async (walletId: WalletId) => {
    setError(null);
    setStatus(null);
    setAmountOut(null);
    setInteractiveUrl(null);
    try {
      setPhase("connecting");
      const adapter = getWalletAdapter(walletId);
      const account = await adapter.connect();
      if (cancelled.current) return;
      setPublicKey(account);

      setPhase("authenticating");
      const info = await fetchAnchorInfo(ANCHOR_DOMAIN);
      const challenge = await getAnchorChallenge(info.webAuthEndpoint, account);
      const signed = await signTransactionWithWallet(
        adapter,
        challenge.transaction,
        {
          networkPassphrase:
            challenge.networkPassphrase || currentNetwork.networkPassphrase,
          address: account,
        },
      );
      if (cancelled.current) return;
      const jwt = await postAnchorToken(info.webAuthEndpoint, signed);

      setPhase("starting");
      const deposit = await startInteractiveDeposit(
        info.transferServerSep24,
        jwt,
        { assetCode: ASSET_CODE, account },
      );
      if (cancelled.current) return;
      // Don't auto-open: window.open() after awaits runs outside the click
      // gesture and popup blockers eat it. We surface a button the buyer
      // clicks (that click IS a gesture → never blocked).
      setInteractiveUrl(deposit.url);
      setPhase("interactive");
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        if (cancelled.current) return;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        if (cancelled.current) return;
        let tx;
        try {
          tx = await getAnchorTransaction(
            info.transferServerSep24,
            jwt,
            deposit.id,
          );
        } catch {
          continue; // transient — keep polling
        }
        setStatus(tx.status);
        setAmountOut(tx.amountOut);
        if (TERMINAL.has(tx.status)) {
          if (tx.status === "completed") {
            setPhase("completed");
          } else {
            // Sentinel: `depositStatus:<status>`, mapped to
            // `d.anchor.errors.depositStatus(status)` at the render site.
            setError({ message: `depositStatus:${tx.status}` });
            setPhase("failed");
          }
          return;
        }
      }
      // Still pending after the budget — leave it recoverable.
      setError({ message: "ANCHOR_STILL_PENDING" });
      setPhase("failed");
    } catch (e) {
      if (cancelled.current) return;
      setError(toError(e));
      setPhase("failed");
    }
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
    setStatus(null);
    setAmountOut(null);
    setInteractiveUrl(null);
  }, []);

  return {
    phase,
    error,
    wallets,
    publicKey,
    status,
    amountOut,
    interactiveUrl,
    anchorDomain: ANCHOR_DOMAIN,
    detectWallets,
    start,
    reset,
  };
}
