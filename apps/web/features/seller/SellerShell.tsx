"use client";

// Seller area shell: VOID identity at operational intensity — layered surface
// panels, grain, one decorative escrow glyph. No GSAP/Lenis/3D; motion is CSS
// transitions/keyframes only and respects prefers-reduced-motion.

import Link from "next/link";
import type { ReactNode } from "react";

/** Decorative escrow mark: nested hairline squares with the blood glyph.
 * Pure SVG, gently floating (motion-safe only). */
export function EscrowMark({ size = 120 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className="motion-safe:animate-[float-slow_7s_ease-in-out_infinite]"
    >
      <rect
        x="10"
        y="10"
        width="100"
        height="100"
        fill="none"
        stroke="rgba(237,234,227,0.14)"
      />
      <rect
        x="60"
        y="18"
        width="60"
        height="60"
        transform="rotate(45 60 60)"
        fill="none"
        stroke="rgba(237,234,227,0.25)"
      />
      <rect
        x="60"
        y="38"
        width="31"
        height="31"
        transform="rotate(45 60 60)"
        fill="none"
        stroke="#FF2D00"
        strokeOpacity="0.7"
      />
      <text x="60" y="65" textAnchor="middle" fontSize="13" fill="#FF2D00">
        ◈
      </text>
    </svg>
  );
}

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
  return (
    <>
      <div className="grain-overlay" aria-hidden />
      {/* Layered backdrop: one deep surface panel bleeding off-canvas. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-y-0 right-0 hidden w-[38vw] border-l border-hairline bg-surface/60 lg:block"
      />
      <div className="relative mx-auto min-h-[100dvh] max-w-5xl px-4 py-8 md:px-6">
        <header className="mb-10 flex items-center justify-between gap-4 border-b border-hairline pb-5">
          <Link href="/seller" className="group flex items-baseline gap-1">
            <span className="text-lg font-semibold tracking-tight text-bone">
              TRUSTIP
            </span>
            <span className="text-lg font-semibold text-blood transition-transform duration-300 group-hover:translate-y-[-2px]">
              .
            </span>
            <span className="micro-label ml-3 hidden text-ash sm:inline">
              Seller
            </span>
          </Link>
          <nav className="flex items-center gap-5">
            <Link
              href="/seller"
              className={`micro-label transition-colors duration-300 hover:text-bone ${
                active === "dashboard" ? "text-bone" : "text-ash"
              }`}
            >
              Ringkasan
            </Link>
            <Link
              href="/seller/onboarding"
              className={`micro-label transition-colors duration-300 hover:text-bone ${
                active === "onboarding" ? "text-bone" : "text-ash"
              }`}
            >
              Persiapan
            </Link>
            <Link
              href="/seller/links"
              className={`micro-label transition-colors duration-300 hover:text-bone ${
                active === "links" ? "text-bone" : "text-ash"
              }`}
            >
              Link Checkout
            </Link>
            <Link
              href="/seller/orders"
              className={`micro-label transition-colors duration-300 hover:text-bone ${
                active === "orders" ? "text-bone" : "text-ash"
              }`}
            >
              Pesanan
            </Link>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="micro-label border border-hairline px-3 py-1.5 text-mist transition-colors duration-300 hover:border-blood hover:text-bone"
                title={email ?? undefined}
              >
                Keluar
              </button>
            )}
          </nav>
        </header>
        {children}
      </div>
    </>
  );
}
