"use client";

// Buyer confirm-received state machine. The client NEVER releases anything by
// itself: it connects the buyer's wallet, asks the backend for a short-lived
// challenge bound to THIS order, has the wallet sign it, and POSTs the
// signature. Every release precondition (and the funding-wallet signature
// check) is enforced server-side. The buyer never chooses the funding key —
// the challenge carries it, and a mismatch is caught before signing and again
// by the backend.

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
  confirmReceived,
  requestConfirmReceivedChallenge,
  StatusApiError,
} from "./status-api";

export type ConfirmPhase =
  | "idle"
  | "connecting"
  | "connected"
  | "preparing" // requesting the challenge
  | "awaiting-signature"
  | "releasing" // POSTing the signed confirm (backend releases + verifies)
  | "done"
  | "failed";

export interface ConfirmError {
  code: string;
  message: string;
}

function toConfirmError(e: unknown): ConfirmError {
  if (e instanceof StatusApiError || e instanceof WalletError) {
    return { code: e.code, message: e.message };
  }
  return {
    code: "InternalError",
    message: e instanceof Error ? e.message : String(e),
  };
}

export function useConfirmReceived(slug: string, orderNo: string) {
  const [phase, setPhase] = useState<ConfirmPhase>("idle");
  const [error, setError] = useState<ConfirmError | null>(null);
  const [wallets, setWallets] = useState<WalletAvailability[]>([]);
  const [walletId, setWalletId] = useState<WalletId | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [releaseTxHash, setReleaseTxHash] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const fail = useCallback((e: unknown, fallbackPhase: ConfirmPhase) => {
    if (cancelled.current) return;
    setError(toConfirmError(e));
    setPhase(fallbackPhase);
  }, []);

  const detectWallets = useCallback(async () => {
    try {
      setWallets(await getAvailableWallets());
    } catch {
      setWallets([]);
    }
  }, []);

  const connect = useCallback(
    async (id: WalletId) => {
      setError(null);
      setWrongNetwork(false);
      setPhase("connecting");
      try {
        const adapter = getWalletAdapter(id);
        const pk = await adapter.connect();
        if (cancelled.current) return;
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
        fail(e, "idle");
      }
    },
    [fail],
  );

  /** Request challenge → verify it targets the connected wallet → sign →
   * POST. Idempotent server-side, so a retry after a transient failure is
   * safe (never double-releases). */
  const confirm = useCallback(async () => {
    if (!walletId || !publicKey) return;
    const networkPassphrase = currentNetwork.networkPassphrase;
    setError(null);
    try {
      setPhase("preparing");
      const challenge = await requestConfirmReceivedChallenge(
        slug,
        orderNo,
        networkPassphrase,
      );
      if (cancelled.current) return;

      // Early, clear feedback: the challenge is built for the funding wallet.
      // If the connected wallet is not it, don't even prompt for a signature.
      if (challenge.buyerPublicKey !== publicKey) {
        fail(
          new StatusApiError(
            "WrongBuyer",
            "connected wallet is not the funding wallet",
            403,
          ),
          "connected",
        );
        return;
      }

      setPhase("awaiting-signature");
      const adapter = getWalletAdapter(walletId);
      const signedXdr = await signTransactionWithWallet(
        adapter,
        challenge.challengeXdr,
        { networkPassphrase, address: publicKey },
      );
      if (cancelled.current) return;

      setPhase("releasing");
      const result = await confirmReceived(slug, orderNo, {
        signedChallengeXdr: signedXdr,
        challengeToken: challenge.challengeToken,
        networkPassphrase,
      });
      if (cancelled.current) return;
      setReleaseTxHash(result.releaseTxHash);
      setPhase("done");
    } catch (e) {
      fail(e, "connected");
    }
  }, [walletId, publicKey, slug, orderNo, fail]);

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
    setWalletId(null);
    setPublicKey(null);
    setWrongNetwork(false);
    setReleaseTxHash(null);
  }, []);

  return {
    phase,
    error,
    wallets,
    walletId,
    publicKey,
    wrongNetwork,
    releaseTxHash,
    detectWallets,
    connect,
    confirm,
    reset,
  };
}
