"use client";

// Buyer checkout state machine. Every money/state truth comes from the backend:
// the client never marks paid, never marks escrow_locked, and only displays
// amounts returned by the API. All backend steps are idempotent, so retrying a
// failed step is always safe.

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
  CheckoutApiError,
  createEscrowOrder,
  createOrder,
  issueCheckoutToken,
  preparePayment,
  requestCheckoutChallenge,
  submitPayment,
  syncPayment,
  type CreateOrderResponse,
  type OrderFormFields,
} from "./checkout-api";

export type CheckoutPhase =
  | "form"
  | "creating-order"
  | "order-ready"
  | "connecting"
  | "connected"
  | "requesting-token"
  | "creating-escrow"
  | "preparing"
  | "awaiting-signature"
  | "submitting"
  | "confirming"
  | "confirmed"
  | "failed";

export interface CheckoutError {
  code: string;
  message: string;
  retryAfterSeconds: number | null;
}

const SYNC_INTERVAL_MS = 2500;
const SYNC_MAX_ATTEMPTS = 80; // ~3.5 minutes before we stop auto-polling

function toCheckoutError(e: unknown): CheckoutError {
  if (e instanceof CheckoutApiError) {
    return {
      code: e.code,
      message: e.message,
      retryAfterSeconds: e.retryAfterSeconds,
    };
  }
  if (e instanceof WalletError) {
    return { code: e.code, message: e.message, retryAfterSeconds: null };
  }
  return {
    code: "InternalError",
    message: e instanceof Error ? e.message : String(e),
    retryAfterSeconds: null,
  };
}

export function useCheckoutFlow(slug: string) {
  const [phase, setPhase] = useState<CheckoutPhase>("form");
  const [error, setError] = useState<CheckoutError | null>(null);
  const [order, setOrder] = useState<CreateOrderResponse | null>(null);
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

  const fail = useCallback((e: unknown, fallbackPhase: CheckoutPhase) => {
    if (cancelled.current) return;
    setError(toCheckoutError(e));
    setPhase(fallbackPhase);
  }, []);

  /** Step 1 — create the order from the buyer's form. */
  const submitDetails = useCallback(
    async (form: OrderFormFields) => {
      setError(null);
      setPhase("creating-order");
      try {
        const created = await createOrder(slug, form);
        if (cancelled.current) return;
        setOrder(created);
        setPhase("order-ready");
      } catch (e) {
        fail(e, "form");
      }
    },
    [slug, fail],
  );

  /** Detect installed wallets (called when reaching the wallet step). */
  const detectWallets = useCallback(async () => {
    try {
      setWallets(await getAvailableWallets());
    } catch {
      setWallets([]);
    }
  }, []);

  /** Step 2 — connect a wallet and verify its network when reportable. */
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
          // wallet cannot report its network — the backend still fails closed
        }
        setWalletId(id);
        setPublicKey(pk);
        setWrongNetwork(mismatch);
        setPhase("connected");
      } catch (e) {
        fail(e, "order-ready");
      }
    },
    [fail],
  );

  /** Steps 3–7 — token → escrow create → prepare → wallet sign → submit →
   * poll sync until the backend reports confirmed/failed. Safe to re-run. */
  const pay = useCallback(async () => {
    if (!order || !walletId || !publicKey) return;
    const networkPassphrase = currentNetwork.networkPassphrase;
    setError(null);
    try {
      // SEP-10: prove wallet ownership before the server will operator-sign an
      // on-chain order. Request a challenge, sign it, then mint the token.
      setPhase("requesting-token");
      const challenge = await requestCheckoutChallenge({
        slug,
        orderNo: order.orderNo,
        buyerPublicKey: publicKey,
        networkPassphrase,
      });
      if (cancelled.current) return;

      setPhase("awaiting-signature");
      const proofAdapter = getWalletAdapter(walletId);
      const signedChallengeXdr = await signTransactionWithWallet(
        proofAdapter,
        challenge.challengeXdr,
        { networkPassphrase, address: publicKey },
      );
      if (cancelled.current) return;

      setPhase("requesting-token");
      const token = await issueCheckoutToken({
        slug,
        orderNo: order.orderNo,
        buyerPublicKey: publicKey,
        networkPassphrase,
        signedChallengeXdr,
        challengeToken: challenge.challengeToken,
      });

      setPhase("creating-escrow");
      await createEscrowOrder({
        orderId: order.orderId,
        buyerPublicKey: publicKey,
        networkPassphrase,
        checkoutToken: token.checkoutToken,
      });

      setPhase("preparing");
      const prepared = await preparePayment({
        orderId: order.orderId,
        buyerPublicKey: publicKey,
        networkPassphrase,
      });

      setPhase("awaiting-signature");
      const adapter = getWalletAdapter(walletId);
      const signedXdr = await signTransactionWithWallet(
        adapter,
        prepared.unsignedXdr,
        { networkPassphrase, address: publicKey },
      );
      if (cancelled.current) return;

      setPhase("submitting");
      const submitted = await submitPayment({
        paymentId: prepared.paymentId,
        signedXdr,
        networkPassphrase,
        attemptToken: prepared.attemptToken,
      });
      setTxHash(submitted.txHash);

      setPhase("confirming");
      for (let i = 0; i < SYNC_MAX_ATTEMPTS; i++) {
        if (cancelled.current) return;
        try {
          const sync = await syncPayment(prepared.paymentId);
          if (sync.status === "confirmed") {
            setTxHash(sync.txHash);
            setPhase("confirmed");
            return;
          }
          if (sync.status === "failed") {
            setError({
              code: "SubmitRejected",
              message: "transaksi gagal di jaringan",
              retryAfterSeconds: null,
            });
            setPhase("failed");
            return;
          }
        } catch (e) {
          // 429 → honor retry-after; transient RPC errors → keep polling.
          if (e instanceof CheckoutApiError && e.status === 429) {
            await new Promise((r) =>
              setTimeout(r, (e.retryAfterSeconds ?? 5) * 1000),
            );
          } else if (!(e instanceof CheckoutApiError)) {
            throw e;
          }
        }
        await new Promise((r) => setTimeout(r, SYNC_INTERVAL_MS));
      }
      // Still pending after the polling budget — leave it retryable.
      setError({
        code: "RpcFailure",
        message: "pembayaran masih diproses jaringan",
        retryAfterSeconds: null,
      });
      setPhase("failed");
    } catch (e) {
      fail(e, "connected");
    }
  }, [order, walletId, publicKey, slug, fail]);

  return {
    phase,
    error,
    order,
    wallets,
    walletId,
    publicKey,
    wrongNetwork,
    txHash,
    networkPassphrase: currentNetwork.networkPassphrase,
    submitDetails,
    detectWallets,
    connect,
    pay,
  };
}
