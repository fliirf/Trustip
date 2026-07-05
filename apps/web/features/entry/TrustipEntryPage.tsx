// Root entry: the real front door of the app. VOID identity at medium
// intensity — layered panels, hairline geometry, one floating escrow mark.
// Server component; the only client code is the imported EscrowMark island.

import Link from "next/link";
import { EscrowMark } from "../seller/SellerShell";

const PATHS = [
  {
    n: "01",
    label: "PEMBELI",
    title: "Saya Pembeli",
    copy: "Buka link checkout dari seller atau cek status pesanan kamu.",
    href: "/buyer",
    cta: "Saya Pembeli",
  },
  {
    n: "02",
    label: "SELLER",
    title: "Mulai Jualan",
    copy: "Buat link checkout terlindungi, verifikasi wallet, dan kelola pesanan.",
    href: "/seller/login",
    cta: "Mulai Jualan",
  },
] as const;

const PROOF_STEPS = [
  "Checkout link",
  "USDC payment",
  "Escrow locked",
  "Status visible",
] as const;

export function TrustipEntryPage() {
  return (
    <>
      <div className="grain-overlay" aria-hidden />
      {/* Layered backdrop: deep surface panel bleeding off the right edge,
          crossed by a single hairline — geometry, not decoration-noise. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-y-0 right-0 hidden w-[42vw] border-l border-hairline bg-surface/60 lg:block"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed top-[62%] right-0 hidden h-px w-[42vw] bg-hairline lg:block"
      />
      <div aria-hidden className="fixed right-[8vw] top-16 hidden lg:block">
        <EscrowMark size={150} />
      </div>

      <main className="relative mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-4 py-8 md:px-6">
        <header className="flex items-baseline gap-1 border-b border-hairline pb-5">
          <span className="text-lg font-semibold tracking-tight text-bone">
            TRUSTIP
          </span>
          <span className="text-lg font-semibold text-blood">.</span>
          <span className="micro-label ml-3 text-ash">Stellar native</span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16 lg:max-w-[52%]">
          <h1 className="text-4xl leading-[1.02] font-semibold tracking-tight text-bone md:text-5xl">
            Protected checkout for risky social commerce.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-mist">
            Buat link checkout terlindungi. Pembeli membayar dengan wallet. Dana
            terkunci di escrow sampai proses selesai.
          </p>

          {/* Two real paths — every CTA routes into the actual app. */}
          <div className="mt-12 grid gap-px border border-hairline bg-hairline sm:grid-cols-2">
            {PATHS.map((p) => (
              <Link
                key={p.n}
                href={p.href}
                className="group relative flex flex-col bg-void p-6 transition-colors duration-300 hover:bg-surface"
              >
                <span className="micro-label text-ash">
                  {p.n} · {p.label}
                </span>
                <span className="mt-4 text-xl font-semibold tracking-tight text-bone">
                  {p.title}
                </span>
                <span className="mt-2 text-[13px] leading-relaxed text-mist">
                  {p.copy}
                </span>
                <span className="micro-label mt-6 inline-flex items-center gap-2 text-mist transition-colors duration-300 group-hover:text-bone">
                  <span className="text-blood transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                  {p.cta}
                </span>
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-px scale-x-0 bg-blood transition-transform duration-500 group-hover:scale-x-100"
                />
              </Link>
            ))}
          </div>
        </section>

        <footer className="border-t border-hairline pt-5 pb-2">
          <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {PROOF_STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className="micro-label text-mist">{step}</span>
                {i < PROOF_STEPS.length - 1 && (
                  <span aria-hidden className="text-[10px] text-blood">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        </footer>
      </main>
    </>
  );
}
