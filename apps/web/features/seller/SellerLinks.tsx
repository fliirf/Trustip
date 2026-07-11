"use client";

// Seller checkout links: create + list. Gated on backend checkoutReady — the
// same condition order creation resolves, so a listed link is always payable.
// All link data shown comes from backend responses.
//
// PHASE 14 — OPERATIONS DESK grammar. The link list was a two-column card grid;
// it is now a MANIFEST: one ruled line per link, slug first because that is the
// thing an operator copies, price and state trailing. No cards, no spreadsheet.

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { EmptyState, ErrorState, ProtocolState } from "../ui/ErrorState";
import { InspectionList } from "./InspectionList";
import { sellerErrorLabel } from "./labels";
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

const fieldCls =
  "desk-field w-full px-3 py-2.5 text-sm text-bone placeholder:text-ash";

const stampCls =
  "desk-stamp os-press micro-label px-3 py-1.5 text-bone hover:text-blood";

function describeError(e: unknown): string {
  if (e instanceof SellerApiError) return sellerErrorLabel(e.code, e.message);
  return sellerErrorLabel("InternalError", "");
}

function checkoutUrl(slug: string): string {
  return `${window.location.origin}/checkout/${slug}`;
}

/** One line on the manifest. */
function ManifestRow({ link }: { link: SellerCheckoutLink }) {
  // "Tersalin" only after the clipboard write actually resolved — the old
  // handler flipped the label optimistically, so a denied clipboard permission
  // showed a confirmation for a copy that never happened.
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const active = link.status === "active";
  const copy = () => {
    navigator.clipboard.writeText(checkoutUrl(link.slug)).then(
      () => setCopied("ok"),
      () => setCopied("fail"),
    );
    setTimeout(() => setCopied(null), 2000);
  };
  return (
    <li className="desk-row grid grid-cols-1 gap-x-6 gap-y-3 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-baseline">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-sm font-semibold tracking-tight text-bone">
            {link.title}
          </span>
          <span className={`micro-label ${active ? "text-blood" : "text-ash"}`}>
            {active ? "Aktif" : link.status}
          </span>
        </div>
        <div className="mt-1.5 font-mono text-[11px] text-ash">/checkout/{link.slug}</div>
        {link.description && (
          <p className="os-note mt-2 max-w-[52ch] text-mist/70">{link.description}</p>
        )}
      </div>

      <div className="os-body text-mist tabular-nums md:text-right">
        {link.priceUsdc} USDC
        <div className="micro-label mt-1 text-ash">
          {new Date(link.createdAt).toLocaleDateString("id-ID")}
        </div>
      </div>

      <div className="flex gap-2 md:justify-end">
        <button type="button" onClick={copy} className={stampCls}>
          {/* The word is the confirmation. A check glyph next to "Tersalin"
              says the same thing twice, in a typeface that is not ours. */}
          {copied === "ok" ? "Tersalin" : copied === "fail" ? "Gagal Menyalin" : "Salin Link"}
        </button>
        <a
          href={`/checkout/${link.slug}`}
          target="_blank"
          rel="noreferrer"
          className={stampCls}
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
        <div className="max-w-md">
          <ProtocolState surface="seller" label="Memverifikasi sesi" />
        </div>
      </SellerShell>
    );
  }

  if (!session.session) {
    return (
      <SellerShell active="links">
        <EmptyState
          surface="seller"
          title="Perlu Masuk"
          detail="Masuk untuk membuat dan mengelola link checkout kamu."
          action={{ label: "Masuk Seller", href: "/seller/login" }}
        />
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
        <div className="desk-sheet max-w-xl px-6 py-10">
          <div className="micro-label text-ash">Persiapan Belum Selesai</div>
          <p className="os-body mt-4 max-w-[48ch] text-mist/80">
            Link checkout butuh profil toko dan wallet utama yang sudah
            terverifikasi, supaya setiap pembayaran punya tujuan yang aman.
          </p>
          <div className="mt-8">
            <InspectionList done={done} />
          </div>
          <Link
            href="/seller/onboarding"
            className="mat-illuminated os-press mt-8 inline-block px-5 py-2.5 text-sm font-semibold tracking-tight text-void hover:text-bone"
          >
            Lanjutkan Persiapan
          </Link>
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
      <div className="engraved-b flex flex-wrap items-end justify-between gap-4 pb-5">
        <div>
          <h1 className="os-title text-bone">Link Checkout</h1>
          <p className="os-body mt-3 max-w-[52ch] text-mist/80">
            Bagikan link ini ke pembeli. Pembayaran mereka ditahan aman sampai
            pesanan diterima.
          </p>
        </div>
        {links !== null && links.length > 0 && (
          <div className="micro-label text-ash tabular-nums">
            {links.length} link · {links.filter((l) => l.status === "active").length} aktif
          </div>
        )}
      </div>

      <div className="grid gap-14 pt-10 pb-16 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-20">
        {/* The order form, clipped to the left of the board. */}
        <section className="min-w-0">
          <div className="micro-label text-ash">Link Baru</div>
          <form onSubmit={onCreate} className="mt-6 space-y-5">
            <label className="block space-y-2">
              <span className="micro-label text-ash">Nama produk</span>
              <input name="title" className={fieldCls} required minLength={1} />
            </label>
            <label className="block space-y-2">
              <span className="micro-label text-ash">Deskripsi (opsional)</span>
              <input name="description" className={fieldCls} />
            </label>
            <label className="block space-y-2">
              <span className="micro-label text-ash">Harga satuan (USDC)</span>
              <input
                name="priceUsdc"
                inputMode="decimal"
                placeholder="2.5"
                pattern="^\d{1,13}(\.\d{1,7})?$"
                title="Angka USDC, maksimal 7 desimal"
                className={`${fieldCls} tabular-nums`}
                required
              />
            </label>
            {error && <ErrorState surface="seller" detail={error} />}
            <button
              type="submit"
              disabled={busy}
              className="mat-illuminated os-press px-5 py-2.5 text-sm font-semibold tracking-tight text-void hover:text-bone"
            >
              {busy ? "Membuat…" : "Buat Link Checkout"}
            </button>
          </form>
        </section>

        {/* The manifest. */}
        <section className="min-w-0">
          <div className="micro-label text-ash">Link Aktif</div>
          <div className="mt-6">
            {links === null && (
              <div className="max-w-md">
                <ProtocolState surface="seller" label="Memuat link checkout" />
              </div>
            )}
            {links !== null && links.length === 0 && (
              <EmptyState
                surface="seller"
                title="Belum ada link checkout"
                detail="Buat yang pertama di sebelah kiri. Pembeli langsung bisa membayar lewat link itu."
              />
            )}
            {links !== null && links.length > 0 && (
              <ul>
                {links.map((l) => (
                  <ManifestRow key={l.id} link={l} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </SellerShell>
  );
}
