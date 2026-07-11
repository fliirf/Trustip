import Link from "next/link";
import type { ReactNode } from "react";

// Shared shell for the public info pages (/cara-kerja, /faq). Same chassis
// plate the buyer entry page uses: wordmark, back link, grain. Server-rendered,
// no client code — these routes must stay as light as the payment routes.
export function InfoShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="grain-overlay" aria-hidden />
      <main className="relative mx-auto min-h-[100dvh] max-w-3xl px-4 py-8 md:px-6">
        <header className="engraved-b flex items-center justify-between pb-5">
          <Link href="/" className="flex items-baseline gap-1">
            <span className="text-lg font-semibold tracking-tight text-bone">
              TRUSTIP
            </span>
            <span className="text-lg font-semibold text-blood">.</span>
          </Link>
          <Link
            href="/"
            className="os-press micro-label py-2 text-ash hover:text-bone"
          >
            Kembali
          </Link>
        </header>
        {children}
      </main>
    </>
  );
}
