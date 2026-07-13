"use client";

// Seller area shell: the desk the whole board is laid on. No GSAP/Lenis/3D;
// motion is CSS transitions/keyframes only and respects prefers-reduced-motion.
//
// PHASE 14 — `EscrowMark` was deleted here. It was a second, near-identical
// drawing of the Escrow artifact with its own geometry, its own float loop and
// its own `◈` glyph, used purely as decoration on the dashboard and the login
// page. Both now render the real `EscrowCore` in its `seal` context. One
// artifact, or it is not an artifact.

import Link from "next/link";
import type { ReactNode } from "react";
import { useDict } from "../i18n/LocaleProvider";

export function SellerShell({
  active,
  onSignOut,
  email,
  children,
}: {
  active: "dashboard" | "onboarding" | "links" | "orders" | "login";
  onSignOut?: (() => void) | null;
  email?: string | null;
  children: ReactNode;
}) {
  const d = useDict();
  const nav = d.seller.nav;
  return (
    <>
      <div className="grain-overlay" aria-hidden />
      {/* The desk itself: a sheet of graphite the whole board is laid on, milled
          down its left edge. It bleeds off-canvas rather than framing anything. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-y-0 right-0 hidden w-[38vw] bg-surface/60 shadow-[inset_1px_0_0_var(--mat-groove),inset_2px_0_0_var(--mat-lip)] lg:block"
      />
      <div className="relative mx-auto min-h-[100dvh] max-w-6xl px-4 py-8 md:px-6">
        <header className="engraved-b mb-12 flex items-center justify-between gap-4 pb-5">
          <Link href="/seller" className="group flex items-baseline gap-1">
            <span className="text-lg font-semibold tracking-tight text-bone">
              TRUSTIP
            </span>
            <span className="text-lg font-semibold text-blood">.</span>
            <span className="micro-label ml-3 hidden text-ash sm:inline">
              {nav.badge}
            </span>
          </Link>
          <nav className="flex items-center gap-5">
            <Link
              href="/seller"
              className={`os-press micro-label py-2 hover:text-bone ${
                active === "dashboard" ? "text-bone" : "text-ash"
              }`}
            >
              {nav.dashboard}
            </Link>
            <Link
              href="/seller/onboarding"
              className={`os-press micro-label py-2 hover:text-bone ${
                active === "onboarding" ? "text-bone" : "text-ash"
              }`}
            >
              {nav.onboarding}
            </Link>
            <Link
              href="/seller/links"
              className={`os-press micro-label py-2 hover:text-bone ${
                active === "links" ? "text-bone" : "text-ash"
              }`}
            >
              {nav.links}
            </Link>
            <Link
              href="/seller/orders"
              className={`os-press micro-label py-2 hover:text-bone ${
                active === "orders" ? "text-bone" : "text-ash"
              }`}
            >
              {nav.orders}
            </Link>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="desk-stamp os-press micro-label px-3 py-1.5 text-mist hover:text-bone"
                title={email ?? undefined}
              >
                {nav.signOut}
              </button>
            )}
          </nav>
        </header>
        {children}
      </div>
    </>
  );
}
