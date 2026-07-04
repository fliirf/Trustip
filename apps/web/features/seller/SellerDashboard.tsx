"use client";

// Seller dashboard shell: backend-backed onboarding checklist + placeholders
// for the upcoming link/order surfaces (Phase 7C/7D).

import Link from "next/link";
import { useEffect, useState } from "react";
import { EscrowMark, SellerShell } from "./SellerShell";
import { STEP_LABELS, sellerErrorLabel } from "./labels";
import {
  getOnboarding,
  SellerApiError,
  type SellerOnboardingStatus,
} from "./seller-api";
import { useSellerSession } from "./useSellerSession";

export function SellerDashboard() {
  const session = useSellerSession();
  const [status, setStatus] = useState<SellerOnboardingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.accessToken) return;
    getOnboarding(session.accessToken).then(setStatus, (e) =>
      setError(
        e instanceof SellerApiError
          ? sellerErrorLabel(e.code, e.message)
          : sellerErrorLabel("InternalError", ""),
      ),
    );
  }, [session.accessToken]);

  if (session.loading) {
    return (
      <SellerShell active="dashboard">
        <p className="micro-label text-ash">Memuat sesi…</p>
      </SellerShell>
    );
  }

  if (!session.session) {
    return (
      <SellerShell active="dashboard">
        <div className="max-w-md border border-hairline bg-surface p-6">
          <div className="micro-label text-ash">Perlu Masuk</div>
          <p className="mt-3 text-sm text-mist/80">
            Masuk untuk melihat ringkasan toko kamu.
          </p>
          <Link
            href="/seller/login"
            className="mt-5 inline-block bg-bone px-5 py-2.5 text-sm font-semibold tracking-tight text-void transition-colors duration-300 hover:bg-blood"
          >
            Masuk Seller
          </Link>
        </div>
      </SellerShell>
    );
  }

  const wallets = status?.wallets ?? [];
  const done = {
    profile: status?.profile !== null && status !== null,
    connect: wallets.length > 0,
    register: wallets.length > 0,
    verify: wallets.some((w) => w.verifiedAt !== null),
    primary: wallets.some((w) => w.isPrimary && w.verifiedAt !== null),
  };

  return (
    <SellerShell
      active="dashboard"
      onSignOut={() => void session.signOut()}
      email={session.email}
    >
      <div className="grid gap-10 md:grid-cols-[1fr_260px]">
        <div>
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-blood">
              ◈
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-bone">
              {status?.profile?.storeName ?? "Toko Kamu"}
            </h1>
          </div>
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-mist/80">
            {status?.checkoutReady
              ? "Toko kamu siap menerima pembayaran terlindungi."
              : "Selesaikan persiapan supaya link checkout kamu bisa menerima pembayaran."}
          </p>

          {error && (
            <p className="mt-6 max-w-md border border-blood/30 px-3 py-2 text-sm text-blood">
              {error}
            </p>
          )}

          <section className="mt-8 max-w-md space-y-0 border border-hairline bg-surface">
            <div className="micro-label border-b border-hairline px-4 py-3 text-ash">
              Checklist Persiapan
            </div>
            <ul>
              {STEP_LABELS.map((step) => {
                const isDone = done[step.key];
                return (
                  <li
                    key={step.key}
                    className="flex items-center justify-between border-b border-hairline px-4 py-3 text-sm last:border-b-0"
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
          </section>

          {!status?.checkoutReady && (
            <Link
              href="/seller/onboarding"
              className="mt-6 inline-block bg-bone px-5 py-2.5 text-sm font-semibold tracking-tight text-void transition-colors duration-300 hover:bg-blood active:scale-[0.99]"
            >
              Lanjutkan Persiapan
            </Link>
          )}

          <section className="mt-10 max-w-md border border-hairline bg-surface px-4 py-4">
            <div className="micro-label text-ash">Link Checkout</div>
            <p className="mt-2 text-sm text-mist/70">
              Buat dan kelola link checkout kamu di tahap berikutnya.
            </p>
          </section>
        </div>

        <aside className="hidden items-start justify-center pt-6 md:flex">
          <EscrowMark size={180} />
        </aside>
      </div>
    </SellerShell>
  );
}
