"use client";

// Buyer checkout island. Lightweight product UI — no landing animation system.
// All money/status truth is rendered from backend responses only.

import { useState, type FormEvent } from "react";
import { CheckoutStatus } from "./CheckoutStatus";
import { OrderSummary, type CheckoutLinkView } from "./OrderSummary";
import { WalletConnect } from "./WalletConnect";
import { errorLabel } from "./labels";
import { useCheckoutFlow } from "./useCheckoutFlow";

const inputCls =
  "w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-sky-400/60 focus:outline-none";

export function BuyerCheckout({ link }: { link: CheckoutLinkView }) {
  const flow = useCheckoutFlow(link.slug);
  const [quantity, setQuantity] = useState(1);

  const onSubmitDetails = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    void flow.submitDetails({
      quantity,
      buyerEmail: get("buyerEmail"),
      buyerName: get("buyerName"),
      shippingAddress: {
        name: get("buyerName"),
        phone: get("phone"),
        addressLine1: get("addressLine1"),
        city: get("city"),
        postalCode: get("postalCode"),
        country: get("country") || "ID",
      },
    });
  };

  const inForm = flow.phase === "form" || flow.phase === "creating-order";
  const inWalletStep =
    flow.phase === "order-ready" || flow.phase === "connecting";
  const readyToPay = flow.phase === "connected";
  const inPayment = !inForm && !inWalletStep && flow.phase !== "connected";

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {inForm && (
          <form onSubmit={onSubmitDetails} className="space-y-4">
            <div className="text-sm font-medium text-gray-200">
              Data Pesanan
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs text-gray-400">Jumlah</span>
              <input
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                  )
                }
                className={inputCls}
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-gray-400">Nama</span>
              <input
                name="buyerName"
                className={inputCls}
                required
                minLength={1}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-gray-400">Email</span>
              <input
                name="buyerEmail"
                type="email"
                className={inputCls}
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-gray-400">No. HP</span>
              <input name="phone" className={inputCls} required minLength={5} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-gray-400">Alamat</span>
              <input name="addressLine1" className={inputCls} required />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs text-gray-400">Kota</span>
                <input name="city" className={inputCls} required />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-gray-400">Kode pos</span>
                <input
                  name="postalCode"
                  className={inputCls}
                  required
                  minLength={3}
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs text-gray-400">
                Negara (kode 2 huruf)
              </span>
              <input
                name="country"
                defaultValue="ID"
                maxLength={2}
                className={inputCls}
                required
              />
            </label>

            {flow.error && (
              <p className="text-sm text-red-400">
                {errorLabel(flow.error.code, flow.error.message)}
              </p>
            )}

            <button
              type="submit"
              disabled={flow.phase === "creating-order"}
              className="w-full rounded-md bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
            >
              {flow.phase === "creating-order"
                ? "Membuat pesanan…"
                : "Lanjut ke Pembayaran"}
            </button>
          </form>
        )}

        {inWalletStep && (
          <>
            <WalletConnect
              wallets={flow.wallets}
              connecting={flow.phase === "connecting"}
              onDetect={flow.detectWallets}
              onConnect={flow.connect}
            />
            {flow.error && (
              <p className="text-sm text-red-400">
                {errorLabel(flow.error.code, flow.error.message)}
              </p>
            )}
          </>
        )}

        {readyToPay && (
          <div className="space-y-4">
            <div className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
              <div className="text-gray-400">Wallet terhubung</div>
              <div className="mt-1 break-all font-mono text-xs text-gray-200">
                {flow.publicKey}
              </div>
            </div>
            {flow.wrongNetwork && (
              <p className="text-sm text-amber-400">
                Jaringan wallet tidak sesuai. Pindahkan wallet ke jaringan
                Stellar yang benar sebelum membayar.
              </p>
            )}
            {flow.error && (
              <p className="text-sm text-red-400">
                {errorLabel(flow.error.code, flow.error.message)}
              </p>
            )}
            <button
              type="button"
              disabled={flow.wrongNetwork}
              onClick={() => void flow.pay()}
              className="w-full rounded-md bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
            >
              Bayar {flow.order?.totalUsdc} USDC
            </button>
          </div>
        )}

        {inPayment && (
          <CheckoutStatus
            phase={flow.phase}
            error={flow.error}
            txHash={flow.txHash}
            onRetry={
              flow.phase === "failed" || flow.error
                ? () => void flow.pay()
                : null
            }
          />
        )}
      </div>

      <OrderSummary
        link={link}
        orderNo={flow.order?.orderNo ?? null}
        totalUsdc={flow.order?.totalUsdc ?? null}
        quantity={quantity}
      />
    </div>
  );
}
