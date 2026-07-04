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
  "w-full border border-hairline bg-surface px-3 py-2.5 text-sm text-bone placeholder:text-ash transition-colors duration-300 focus:border-blood/70 focus:outline-none";

const labelCls = "micro-label text-ash";

const ctaCls =
  "w-full bg-bone px-4 py-3 text-sm font-semibold tracking-tight text-void transition-colors duration-300 hover:bg-blood active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40";

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
    <div className="grid gap-8 md:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {inForm && (
          <form onSubmit={onSubmitDetails} className="space-y-5">
            <div className="flex items-center gap-2">
              <span className="micro-label text-mist">01 · Data Pesanan</span>
              <span className="h-px flex-1 bg-hairline" aria-hidden />
            </div>

            <label className="block space-y-2">
              <span className={labelCls}>Jumlah</span>
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
            <label className="block space-y-2">
              <span className={labelCls}>Nama</span>
              <input
                name="buyerName"
                className={inputCls}
                required
                minLength={1}
              />
            </label>
            <label className="block space-y-2">
              <span className={labelCls}>Email</span>
              <input
                name="buyerEmail"
                type="email"
                className={inputCls}
                required
              />
            </label>
            <label className="block space-y-2">
              <span className={labelCls}>No. HP</span>
              <input name="phone" className={inputCls} required minLength={5} />
            </label>
            <label className="block space-y-2">
              <span className={labelCls}>Alamat</span>
              <input name="addressLine1" className={inputCls} required />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block space-y-2">
                <span className={labelCls}>Kota</span>
                <input name="city" className={inputCls} required />
              </label>
              <label className="block space-y-2">
                <span className={labelCls}>Kode pos</span>
                <input
                  name="postalCode"
                  className={inputCls}
                  required
                  minLength={3}
                />
              </label>
            </div>
            <label className="block space-y-2">
              <span className={labelCls}>Negara (kode 2 huruf)</span>
              <input
                name="country"
                defaultValue="ID"
                maxLength={2}
                className={inputCls}
                required
              />
            </label>

            {flow.error && (
              <p className="border border-blood/30 px-3 py-2 text-sm text-blood">
                {errorLabel(flow.error.code, flow.error.message)}
              </p>
            )}

            <button
              type="submit"
              disabled={flow.phase === "creating-order"}
              className={ctaCls}
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
              <p className="border border-blood/30 px-3 py-2 text-sm text-blood">
                {errorLabel(flow.error.code, flow.error.message)}
              </p>
            )}
          </>
        )}

        {readyToPay && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <span className="micro-label text-mist">03 · Pembayaran</span>
              <span className="h-px flex-1 bg-hairline" aria-hidden />
            </div>
            <div className="border border-hairline bg-surface px-4 py-3">
              <div className="micro-label text-ash">Wallet terhubung</div>
              <div className="mt-2 break-all font-mono text-xs text-mist">
                {flow.publicKey}
              </div>
            </div>
            {flow.wrongNetwork && (
              <p className="border border-blood/30 px-3 py-2 text-sm text-blood">
                Jaringan wallet tidak sesuai. Pindahkan wallet ke jaringan
                Stellar yang benar sebelum membayar.
              </p>
            )}
            {flow.error && (
              <p className="border border-blood/30 px-3 py-2 text-sm text-blood">
                {errorLabel(flow.error.code, flow.error.message)}
              </p>
            )}
            <button
              type="button"
              disabled={flow.wrongNetwork}
              onClick={() => void flow.pay()}
              className={ctaCls}
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
