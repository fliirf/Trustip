"use client";

// Buyer manual entry: paste a checkout/status link, or type slug + order
// number. Client-side parsing + redirect only — existence is never checked
// here (the public routes 404 safely on their own).
//
// PHASE 14 — this is where a buyer walks up to the machine, so it speaks
// TERMINAL: a chassis plate, two glass fields, two keys. It used the default
// bordered-box form before, which made the buyer's first screen look like the
// seller's desk.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDict } from "../i18n/LocaleProvider";
import { normalizeOrderNo, parseBuyerInput, targetUrl } from "./entry-utils";

const fieldCls =
  "terminal-control w-full bg-transparent px-4 py-3 text-[14px] text-bone placeholder:text-ash focus:outline-none";

export function BuyerEntryPage() {
  const router = useRouter();
  const d = useDict();
  const t = d.entry;
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
      setError(t.errorUnknown);
      return;
    }
    router.push(targetUrl({ slug: target.slug }));
  };

  const openStatus = () => {
    const target = resolve();
    if (!target) {
      setError(t.errorUnknown);
      return;
    }
    if (!target.orderNo) {
      setError(t.errorNeedOrder);
      return;
    }
    router.push(targetUrl(target));
  };

  return (
    <>
      <div className="grain-overlay" aria-hidden />

      <main className="relative mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-4 py-8 md:px-6">
        <header className="engraved-b flex items-center justify-between pb-5">
          <Link href="/" className="group flex items-baseline gap-1">
            <span className="text-lg font-semibold tracking-tight text-bone">TRUSTIP</span>
            <span className="text-lg font-semibold text-blood">.</span>
            <span className="micro-label ml-3 hidden text-ash sm:inline">{t.tag}</span>
          </Link>
          <Link href="/" className="os-press micro-label py-2 text-ash hover:text-bone">
            {d.common.back}
          </Link>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16 lg:max-w-[58%]">
          <h1 className="os-title text-bone">{t.title}</h1>
          <p className="os-body mt-5 max-w-md text-mist">{t.body}</p>
          <Link
            href="/cara-kerja"
            className="os-press micro-label mt-4 inline-block py-2 text-ash hover:text-bone"
          >
            {t.firstTime}
          </Link>

          <form
            className="mt-12 flex max-w-md flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              // Enter follows what the buyer actually filled in: with an order
              // number present they came to check status, and routing them to
              // checkout would silently drop the number they just typed.
              if (normalizeOrderNo(orderNo)) openStatus();
              else openCheckout();
            }}
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="buyer-link" className="micro-label text-ash">
                {t.linkLabel}
              </label>
              <input
                id="buyer-link"
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError(null);
                }}
                placeholder={t.linkPlaceholder}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={error !== null || undefined}
                className={fieldCls}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="buyer-order" className="micro-label text-ash">
                {t.orderLabel}
              </label>
              <input
                id="buyer-order"
                type="text"
                value={orderNo}
                onChange={(e) => {
                  setOrderNo(e.target.value);
                  setError(null);
                }}
                placeholder={t.orderPlaceholder}
                autoComplete="off"
                spellCheck={false}
                className={`${fieldCls} font-mono`}
              />
            </div>

            {/* The machine's fault lamp, in the same channel the checkout
                terminal lights when a stage fails. */}
            {error && (
              <div role="alert" className="relative pl-4">
                <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-blood" />
                <p className="os-note text-blood">{error}</p>
              </div>
            )}

            {/* The primary key's label tracks what submit will actually do:
                with an order number present, submit routes to STATUS (see the
                form handler above), and a key that says "Buka Checkout" while
                doing that would lie to the buyer. When the label becomes
                "Cek Status", the secondary key would duplicate it, so it
                steps aside. */}
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="mat-illuminated os-press micro-label px-6 py-3.5 text-void hover:text-bone"
              >
                {normalizeOrderNo(orderNo) ? t.checkStatus : t.openCheckout}
              </button>
              {!normalizeOrderNo(orderNo) && (
                <button
                  type="button"
                  onClick={openStatus}
                  className="mat-key os-press micro-label border border-hairline px-6 py-3.5 text-mist hover:text-bone"
                >
                  {t.checkStatus}
                </button>
              )}
            </div>
          </form>
        </section>
      </main>
    </>
  );
}
