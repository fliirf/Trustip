"use client";

// Buyer manual entry: paste a checkout/status link, or type slug + order
// number. Client-side parsing + redirect only — existence is never checked
// here (the public routes 404 safely on their own).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizeOrderNo, parseBuyerInput, targetUrl } from "./entry-utils";

const ERROR_COPY =
  "Link atau kode tidak dikenali. Periksa kembali link dari seller kamu.";
const ERROR_NEED_ORDER =
  "Masukkan nomor pesanan (contoh: TRP-…) untuk cek status.";

export function BuyerEntryPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resolve = () => {
    const target = parseBuyerInput(input);
    if (!target) return null;
    const manual = normalizeOrderNo(orderNo);
    // Manual order-number field wins over (or complements) the pasted link.
    return manual ? { slug: target.slug, orderNo: manual } : target;
  };

  const openCheckout = () => {
    const target = parseBuyerInput(input);
    if (!target) {
      setError(ERROR_COPY);
      return;
    }
    router.push(targetUrl({ slug: target.slug }));
  };

  const openStatus = () => {
    const target = resolve();
    if (!target) {
      setError(ERROR_COPY);
      return;
    }
    if (!target.orderNo) {
      setError(ERROR_NEED_ORDER);
      return;
    }
    router.push(targetUrl(target));
  };

  const inputCls =
    "w-full border border-hairline bg-surface px-4 py-3 text-[14px] text-bone placeholder:text-ash focus:border-blood focus:outline-none transition-colors duration-300";

  return (
    <>
      <div className="grain-overlay" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-y-0 right-0 hidden w-[38vw] border-l border-hairline bg-surface/60 lg:block"
      />

      <main className="relative mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-4 py-8 md:px-6">
        <header className="flex items-center justify-between border-b border-hairline pb-5">
          <Link href="/" className="group flex items-baseline gap-1">
            <span className="text-lg font-semibold tracking-tight text-bone">
              TRUSTIP
            </span>
            <span className="text-lg font-semibold text-blood transition-transform duration-300 group-hover:translate-y-[-2px]">
              .
            </span>
            <span className="micro-label ml-3 hidden text-ash sm:inline">
              Pembeli
            </span>
          </Link>
          <Link
            href="/"
            className="micro-label text-ash transition-colors duration-300 hover:text-bone"
          >
            Kembali
          </Link>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16 lg:max-w-[55%]">
          <h1 className="text-3xl leading-[1.05] font-semibold tracking-tight text-bone md:text-4xl">
            Buka checkout atau cek status pesanan.
          </h1>
          <p className="mt-5 max-w-md text-[14px] leading-relaxed text-mist">
            Biasanya link diberikan oleh seller melalui DM, WhatsApp, atau
            halaman toko.
          </p>

          <form
            className="mt-10 flex max-w-md flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              openCheckout();
            }}
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="buyer-link" className="micro-label text-mist">
                Link atau kode checkout
              </label>
              <input
                id="buyer-link"
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError(null);
                }}
                placeholder="https://…/checkout/kode-toko atau kode-toko"
                autoComplete="off"
                spellCheck={false}
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="buyer-order" className="micro-label text-mist">
                Nomor pesanan (untuk cek status)
              </label>
              <input
                id="buyer-order"
                type="text"
                value={orderNo}
                onChange={(e) => {
                  setOrderNo(e.target.value);
                  setError(null);
                }}
                placeholder="TRP-…"
                autoComplete="off"
                spellCheck={false}
                className={inputCls}
              />
            </div>

            {error && (
              <p role="alert" className="text-[13px] text-blood">
                {error}
              </p>
            )}

            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="micro-label border border-bone bg-bone px-6 py-3 text-void transition-colors duration-300 hover:border-blood hover:bg-blood hover:text-bone"
              >
                Buka Checkout
              </button>
              <button
                type="button"
                onClick={openStatus}
                className="micro-label border border-hairline px-6 py-3 text-mist transition-colors duration-300 hover:border-blood hover:text-bone"
              >
                Cek Status
              </button>
            </div>
          </form>
        </section>
      </main>
    </>
  );
}
