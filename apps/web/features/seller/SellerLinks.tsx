"use client";

// Seller checkout links: create + list. Gated on backend checkoutReady — the
// same condition order creation resolves, so a listed link is always payable.
// All link data shown comes from backend responses.

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { sellerErrorLabel, STEP_LABELS } from "./labels";
import {
  createCheckoutLink,
  getOnboarding,
  listCheckoutLinks,
  SellerApiError,
  type SellerCheckoutLink,
  type SellerOnboardingStatus,
} from "./seller-api";
import { SellerShell } from "./SellerShell";
import { useSellerSession } from "./useSellerSession";

const inputCls =
  "w-full border border-hairline bg-surface px-3 py-2.5 text-sm text-bone placeholder:text-ash transition-colors duration-300 focus:border-blood/70 focus:outline-none";

const ctaCls =
  "bg-bone px-5 py-2.5 text-sm font-semibold tracking-tight text-void transition-colors duration-300 hover:bg-blood active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40";

const ghostCls =
  "micro-label border border-hairline px-3 py-1.5 text-bone transition-colors duration-300 hover:border-blood active:scale-[0.99]";

function describeError(e: unknown): string {
  if (e instanceof SellerApiError) return sellerErrorLabel(e.code, e.message);
  return sellerErrorLabel("InternalError", "");
}

function checkoutUrl(slug: string): string {
  return `${window.location.origin}/checkout/${slug}`;
}

function LinkCard({ link }: { link: SellerCheckoutLink }) {
  const [copied, setCopied] = useState(false);
  const active = link.status === "active";
  return (
    <li className="group border border-hairline bg-surface p-4 transition-colors duration-300 hover:border-bone/30">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-base font-semibold tracking-tight text-bone">
          {link.title}
        </span>
        <span className="text-sm text-mist">{link.priceUsdc} USDC</span>
      </div>
      {link.description && (
        <p className="mt-1 text-sm text-mist/70">{link.description}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
        <span className="font-mono text-[11px] text-ash">
          /checkout/{link.slug}
        </span>
        <span className="flex items-center gap-2">
          <span className={`micro-label ${active ? "text-blood" : "text-ash"}`}>
            {active ? "Aktif" : link.status}
          </span>
          <span className="micro-label text-ash">
            {new Date(link.createdAt).toLocaleDateString("id-ID")}
          </span>
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(checkoutUrl(link.slug));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className={ghostCls}
        >
          {copied ? "Tersalin ✓" : "Salin Link"}
        </button>
        <a
          href={`/checkout/${link.slug}`}
          target="_blank"
          rel="noreferrer"
          className={ghostCls}
        >
          Buka
        </a>
      </div>
    </li>
  );
}

export function SellerLinks() {
  const session = useSellerSession();
  const token = session.accessToken;

  const [status, setStatus] = useState<SellerOnboardingStatus | null>(null);
  const [links, setLinks] = useState<SellerCheckoutLink[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [onboarding, list] = await Promise.all([
        getOnboarding(token),
        listCheckoutLinks(token),
      ]);
      setStatus(onboarding);
      setLinks(list.links);
      setError(null);
    } catch (e) {
      setError(describeError(e));
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCreate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const title = String(f.get("title") ?? "").trim();
    const description = String(f.get("description") ?? "").trim();
    const priceUsdc = String(f.get("priceUsdc") ?? "").trim();
    if (!token) return;
    setBusy(true);
    setError(null);
    createCheckoutLink(token, {
      title,
      priceUsdc,
      ...(description ? { description } : {}),
    })
      .then(async () => {
        form.reset();
        await refresh();
      })
      .catch((err) => setError(describeError(err)))
      .finally(() => setBusy(false));
  };

  if (session.loading) {
    return (
      <SellerShell active="links">
        <p className="micro-label text-ash">Memuat sesi…</p>
      </SellerShell>
    );
  }

  if (!session.session) {
    return (
      <SellerShell active="links">
        <div className="max-w-md border border-hairline bg-surface p-6">
          <div className="micro-label text-ash">Perlu Masuk</div>
          <p className="mt-3 text-sm text-mist/80">
            Masuk untuk membuat dan mengelola link checkout kamu.
          </p>
          <Link href="/seller/login" className={`mt-5 inline-block ${ctaCls}`}>
            Masuk Seller
          </Link>
        </div>
      </SellerShell>
    );
  }

  // Onboarding gate — mirrors the backend SellerNotReady rule.
  if (status && !status.checkoutReady) {
    const wallets = status.wallets;
    const done = {
      profile: status.profile !== null,
      connect: wallets.length > 0,
      register: wallets.length > 0,
      verify: wallets.some((w) => w.verifiedAt !== null),
      primary: wallets.some((w) => w.isPrimary && w.verifiedAt !== null),
    };
    return (
      <SellerShell
        active="links"
        onSignOut={() => void session.signOut()}
        email={session.email}
      >
        <div className="max-w-lg border border-hairline bg-surface">
          <div className="border-b border-hairline px-5 py-4">
            <div className="micro-label flex items-center gap-2 text-ash">
              <span aria-hidden className="text-blood">
                ◈
              </span>
              Persiapan Belum Selesai
            </div>
            <p className="mt-2 text-sm leading-relaxed text-mist/80">
              Link checkout butuh profil toko dan wallet utama yang sudah
              terverifikasi, supaya setiap pembayaran punya tujuan yang aman.
            </p>
          </div>
          <ul>
            {STEP_LABELS.map((step) => {
              const isDone = done[step.key];
              return (
                <li
                  key={step.key}
                  className="flex items-center justify-between border-b border-hairline px-5 py-3 text-sm last:border-b-0"
                >
                  <span className={isDone ? "text-bone" : "text-ash"}>
                    {step.label}
                  </span>
                  <span
                    className={`micro-label ${
                      isDone ? "text-blood" : "text-bone/25"
                    }`}
                  >
                    {isDone ? "Selesai" : "Belum"}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="px-5 py-4">
            <Link href="/seller/onboarding" className={ctaCls}>
              Lanjutkan Persiapan
            </Link>
          </div>
        </div>
      </SellerShell>
    );
  }

  return (
    <SellerShell
      active="links"
      onSignOut={() => void session.signOut()}
      email={session.email}
    >
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden className="text-blood">
          ◈
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-bone">
          Link Checkout
        </h1>
      </div>
      <p className="mb-10 max-w-[52ch] text-sm leading-relaxed text-mist/80">
        Bagikan link ini ke pembeli — pembayaran mereka ditahan aman sampai
        pesanan diterima.
      </p>

      <div className="space-y-12 pb-16">
        {/* 01 · LINK BARU */}
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="micro-label text-mist">01 · Link Baru</span>
            <span className="h-px flex-1 bg-hairline" aria-hidden />
          </div>
          <form onSubmit={onCreate} className="max-w-md space-y-4">
            <label className="block space-y-2">
              <span className="micro-label text-ash">Nama produk</span>
              <input name="title" className={inputCls} required minLength={1} />
            </label>
            <label className="block space-y-2">
              <span className="micro-label text-ash">Deskripsi (opsional)</span>
              <input name="description" className={inputCls} />
            </label>
            <label className="block space-y-2">
              <span className="micro-label text-ash">Harga satuan (USDC)</span>
              <input
                name="priceUsdc"
                inputMode="decimal"
                placeholder="2.5"
                pattern="^\d{1,13}(\.\d{1,7})?$"
                title="Angka USDC, maksimal 7 desimal"
                className={inputCls}
                required
              />
            </label>
            {error && (
              <p className="border border-blood/30 px-3 py-2 text-sm text-blood">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className={ctaCls}>
              {busy ? "Membuat…" : "Buat Link Checkout"}
            </button>
          </form>
        </section>

        {/* 02 · LINK AKTIF */}
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="micro-label text-mist">02 · Link Aktif</span>
            <span className="h-px flex-1 bg-hairline" aria-hidden />
          </div>
          {links === null && (
            <p className="micro-label text-ash">Memuat link…</p>
          )}
          {links !== null && links.length === 0 && (
            <div className="max-w-md border border-hairline bg-surface px-5 py-8 text-center">
              <span aria-hidden className="text-lg text-blood">
                ◈
              </span>
              <p className="mt-3 text-sm text-mist/80">
                Belum ada link checkout. Buat yang pertama di atas — pembeli
                langsung bisa membayar lewat link itu.
              </p>
            </div>
          )}
          {links !== null && links.length > 0 && (
            <ul className="grid max-w-2xl gap-4 sm:grid-cols-2">
              {links.map((l) => (
                <LinkCard key={l.id} link={l} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </SellerShell>
  );
}
