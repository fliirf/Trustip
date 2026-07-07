/* Real root landing — the optimized Trustip VOID identity ported from the
   prototype, rebuilt as server-rendered HTML + CSS motion. No framer-motion,
   no smooth-scroll lib, no mock wallet/payment behavior: every CTA routes
   into the actual product. The only client code is the Reveal island. */

import Link from "next/link";
import { OrbitalCore } from "./OrbitalCore";
import { Reveal } from "./Reveal";
import { displayFont, monoFont } from "./fonts";

const NAV = [
  { id: "problem", label: "RISK", n: "02" },
  { id: "checkout", label: "CHECKOUT", n: "03" },
  { id: "escrow", label: "ESCROW", n: "04" },
  { id: "trust", label: "TRUST", n: "05" },
] as const;

const MARQUEE = [
  "PROTECTED CHECKOUT",
  "USDC ON STELLAR",
  "SOROBAN ESCROW",
  "SOCIAL COMMERCE",
  "TRUST PROFILE",
  "JASTIP",
  "PRE-ORDER",
  "GROUP BUY",
] as const;

const RISK_CASES = [
  {
    platform: "INSTAGRAM",
    scenario: "Jastip pre-order",
    risk: "Transfer duluan, chat dihapus. Tidak ada jejak, tidak ada recourse.",
  },
  {
    platform: "TIKTOK",
    scenario: "Group buy",
    risk: "Sepuluh pembeli patungan. Organizer hilang setelah dana terkumpul.",
  },
  {
    platform: "WHATSAPP",
    scenario: "Barang second",
    risk: "DP 50% dibayar. Barang tidak pernah dikirim. Tanpa tracking.",
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Seller membuat link",
    copy: "Setelah onboarding dan verifikasi wallet, seller membuat link checkout terlindungi untuk produknya.",
  },
  {
    n: "02",
    title: "Pembeli bayar USDC",
    copy: "Pembeli membuka link, mengisi pesanan, dan membayar USDC di Stellar lewat wallet miliknya sendiri.",
  },
  {
    n: "03",
    title: "Dana terkunci di escrow",
    copy: "Setelah pembayaran terverifikasi di jaringan, dana terkunci di escrow — bukan di seller, bukan di Trustip.",
  },
] as const;

const RAIL = [
  "Menunggu Pembayaran",
  "Pesanan Aman",
  "Dikemas",
  "Dikirim",
  "Pesanan Diterima",
  "Selesai",
] as const;

const PRINCIPLES = [
  {
    numeral: "I",
    title: "Trust is not a screenshot.",
    body: "Bukti chat dan screenshot transfer tidak melindungi siapa pun. Trustip mengganti bukti tangkapan layar dengan bukti kontrak.",
  },
  {
    numeral: "II",
    title: "The buyer never marks paid.",
    body: "Tidak ada tombol “saya sudah bayar”. Pembayaran dikonfirmasi dari jaringan Stellar, bukan dari klik.",
  },
  {
    numeral: "III",
    title: "The seller earns release.",
    body: "Dana pindah ke seller hanya setelah pesanan dikonfirmasi diterima, atau setelah peninjauan selesai.",
  },
] as const;

const PATHS = [
  {
    n: "01",
    label: "PEMBELI",
    title: "Saya Pembeli",
    copy: "Buka link checkout dari seller atau cek status pesanan kamu.",
    href: "/buyer",
    cta: "Buka Link Checkout",
  },
  {
    n: "02",
    label: "SELLER",
    title: "Mulai Jualan",
    copy: "Buat link checkout terlindungi, verifikasi wallet, dan kelola pesanan.",
    href: "/seller/login",
    cta: "Buat Checkout Terlindungi",
  },
] as const;

function MicroTag({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 flex items-center gap-3">
      <span className="micro-label font-mono-jb text-mist">[{n}]</span>
      <span className="h-px w-8 bg-hairline" />
      <span className="micro-label font-mono-jb text-mist">{children}</span>
    </div>
  );
}

export function VoidLanding() {
  return (
    <div className={`${displayFont.variable} ${monoFont.variable} landing-root relative bg-void text-bone`}>
      <div className="grain-overlay" aria-hidden />

      {/* Nav — hairline header, anchors + real entry links */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-hairline bg-void/85 backdrop-blur-sm">
        <div className="flex items-center justify-between px-5 py-3 md:px-10">
          <a href="#hero" className="flex items-baseline">
            <span className="font-display text-lg font-medium tracking-tight text-bone">TRUSTIP</span>
            <span className="font-display text-lg font-medium text-blood">.</span>
          </a>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Section">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="micro-label font-mono-jb text-ash transition-colors duration-300 hover:text-bone"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/buyer" className="micro-label font-mono-jb text-mist transition-colors hover:text-bone">
              Saya Pembeli
            </Link>
            <Link
              href="/seller/login"
              className="micro-label border border-hairline px-3 py-2 font-mono-jb text-bone transition-colors duration-300 hover:border-blood hover:text-blood"
            >
              Mulai Jualan
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* ---- 01 · HERO ---- */}
        <section id="hero" className="relative flex min-h-[100svh] flex-col overflow-hidden">
          <OrbitalCore className="absolute top-1/2 left-1/2 z-0 h-[130vw] max-h-[1000px] w-[130vw] max-w-[1000px] -translate-x-1/2 -translate-y-1/2 md:h-[90vw] md:w-[90vw]" />

          <div className="relative z-10 flex items-start justify-between px-5 pt-24 md:px-10">
            <span className="micro-label font-mono-jb text-ash">[01] / Protected Checkout</span>
            <span className="micro-label hidden font-mono-jb text-ash md:block">STELLAR NATIVE · USDC</span>
          </div>

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 text-center">
            <h1 className="font-display text-[clamp(56px,15vw,220px)] leading-none font-medium tracking-tight">
              TRUSTIP<span className="text-blood">.</span>
            </h1>
            <p className="font-display mt-6 max-w-2xl text-[clamp(24px,4vw,52px)] leading-[1.06] font-normal tracking-tight text-bone md:mt-10">
              Protected checkout for risky social commerce.
            </p>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-mist md:text-[17px]">
              Link checkout menjadi{" "}
              <span className="border-b border-blood pb-0.5 text-bone">pembayaran terlindungi</span>. Pembeli membayar
              USDC di Stellar. Dana terkunci di escrow sampai pesanan selesai.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row md:mt-14">
              <Link
                href="/buyer"
                className="micro-label bg-bone px-8 py-4 font-mono-jb text-void transition-colors duration-300 hover:bg-blood hover:text-bone"
              >
                Saya Pembeli
              </Link>
              <Link
                href="/seller/login"
                className="micro-label border border-hairline px-8 py-4 font-mono-jb text-bone transition-colors duration-300 hover:border-blood hover:text-blood"
              >
                Mulai Jualan
              </Link>
            </div>
          </div>

          {/* Bottom marquee — pure CSS */}
          <div className="relative z-10 overflow-hidden border-t border-hairline py-4">
            <div className="marquee-track flex whitespace-nowrap">
              {[...MARQUEE, ...MARQUEE].map((item, i) => (
                <span key={i} className="mx-4 flex items-center" aria-hidden={i >= MARQUEE.length}>
                  <span className="micro-label font-mono-jb text-ash">{item}</span>
                  <span className="ml-4 text-bone/20">·</span>
                </span>
              ))}
            </div>
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[30vh]"
            style={{ background: "linear-gradient(to bottom, transparent, #050505 85%)" }}
          />
        </section>

        {/* ---- 02 · PROBLEM ---- */}
        <section id="problem" className="scroll-mt-16 px-5 py-24 md:px-10 md:py-36">
          <Reveal>
            <MicroTag n="02">Kenapa transfer duluan berisiko</MicroTag>
            <h2 className="font-display max-w-3xl text-[clamp(32px,6vw,80px)] leading-[0.95] font-normal tracking-tight">
              Social commerce berjalan di atas kepercayaan buta.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-px border border-hairline bg-hairline md:grid-cols-3">
            {RISK_CASES.map((c) => (
              <div key={c.platform + c.scenario} className="bg-void p-6 md:p-8">
                <div className="flex items-center justify-between">
                  <span className="micro-label font-mono-jb text-ash">{c.platform}</span>
                  <span className="micro-label font-mono-jb text-blood/70">RISK</span>
                </div>
                <div className="font-display mt-6 text-xl font-medium tracking-tight text-bone">{c.scenario}</div>
                <p className="mt-3 text-[14px] leading-relaxed text-mist">{c.risk}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- 03 · PROTECTED CHECKOUT ---- */}
        <section id="checkout" className="scroll-mt-16 border-t border-hairline px-5 py-24 md:px-10 md:py-36">
          <Reveal>
            <MicroTag n="03">Cara kerja checkout terlindungi</MicroTag>
            <h2 className="font-display max-w-3xl text-[clamp(32px,6vw,80px)] leading-[0.95] font-normal tracking-tight">
              Satu link. Pembayaran wallet. Dana terkunci.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
            {STEPS.map((s) => (
              <Reveal key={s.n}>
                <div className="border-l border-hairline pl-5">
                  <span className="micro-label font-mono-jb text-blood">{s.n}</span>
                  <div className="font-display mt-4 text-2xl font-medium tracking-tight text-bone">{s.title}</div>
                  <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-mist">{s.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-14">
            <Link
              href="/seller/login"
              className="micro-label inline-block border border-hairline px-8 py-4 font-mono-jb text-bone transition-colors duration-300 hover:border-blood hover:text-blood"
            >
              Buat Checkout Terlindungi →
            </Link>
          </div>
        </section>

        {/* ---- 04 · ESCROW / PROOF ---- */}
        <section id="escrow" className="scroll-mt-16 border-t border-hairline px-5 py-24 md:px-10 md:py-36">
          <Reveal>
            <MicroTag n="04">Bagaimana dana tetap aman</MicroTag>
            <h2 className="font-display max-w-3xl text-[clamp(32px,6vw,80px)] leading-[0.95] font-normal tracking-tight">
              Dana tidak bergerak sampai pesanan selesai.
            </h2>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-mist md:text-[17px]">
              Setelah pembayaran terkonfirmasi di jaringan, dana ditahan di escrow. Status pesanan yang kamu lihat
              berasal dari catatan yang terverifikasi — bukan klaim sepihak.
            </p>
          </Reveal>

          {/* Lifecycle rail — real buyer-facing states */}
          <div className="mt-14 overflow-x-auto">
            <ol className="flex min-w-max items-center gap-3 border border-hairline p-5 md:p-8">
              {RAIL.map((state, i) => (
                <li key={state} className="flex items-center gap-3">
                  <span className="flex flex-col gap-2">
                    <span className="micro-label font-mono-jb text-ash">0{i + 1}</span>
                    <span
                      className={`micro-label font-mono-jb ${i === 1 ? "text-blood" : "text-bone"}`}
                    >
                      {state}
                    </span>
                  </span>
                  {i < RAIL.length - 1 && <span aria-hidden className="mx-1 h-px w-8 bg-hairline md:w-14" />}
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/buyer"
              className="micro-label inline-block border border-hairline px-8 py-4 font-mono-jb text-bone transition-colors duration-300 hover:border-blood hover:text-blood"
            >
              Cek Status Pesanan →
            </Link>
          </div>
        </section>

        {/* ---- Principles strip ---- */}
        <section className="border-t border-hairline px-5 py-24 md:px-10 md:py-32">
          <div className="grid gap-12 md:grid-cols-3 md:gap-8">
            {PRINCIPLES.map((p) => (
              <Reveal key={p.numeral}>
                <div>
                  <span className="font-display text-3xl text-blood">{p.numeral}</span>
                  <div className="font-display mt-4 text-2xl font-medium tracking-tight text-bone">{p.title}</div>
                  <p className="mt-3 text-[14px] leading-relaxed text-mist">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---- 05 · SELLER TRUST ---- */}
        <section id="trust" className="scroll-mt-16 border-t border-hairline px-5 py-24 md:px-10 md:py-36">
          <Reveal>
            <MicroTag n="05">Reputasi yang bisa dibuktikan</MicroTag>
            <h2 className="font-display max-w-3xl text-[clamp(32px,6vw,80px)] leading-[0.95] font-normal tracking-tight">
              Seller membangun trust profile dari pesanan yang selesai.
            </h2>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-mist md:text-[17px]">
              Setiap checkout terlindungi yang selesai tercatat. Pembeli melihat riwayat yang nyata, bukan testimoni
              yang bisa dikarang.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-px border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["LINK", "Checkout link dengan identitas seller terverifikasi"],
              ["WALLET", "Wallet seller diverifikasi lewat ownership challenge"],
              ["ORDERS", "Riwayat pesanan terlindungi yang selesai"],
              ["STATUS", "Halaman status publik untuk setiap pesanan"],
            ].map(([tag, copy]) => (
              <div key={tag} className="bg-void p-6">
                <span className="micro-label font-mono-jb text-blood/70">{tag}</span>
                <p className="mt-4 text-[14px] leading-relaxed text-mist">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- 06 · ENTRY PATHS ---- */}
        <section id="entry" className="scroll-mt-16 border-t border-hairline px-5 py-24 md:px-10 md:py-36">
          <Reveal>
            <MicroTag n="06">Mulai dari sini</MicroTag>
          </Reveal>
          <div className="grid gap-px border border-hairline bg-hairline sm:grid-cols-2">
            {PATHS.map((p) => (
              <Link
                key={p.n}
                href={p.href}
                className="group relative flex flex-col bg-void p-8 transition-colors duration-300 hover:bg-surface md:p-12"
              >
                <span className="micro-label font-mono-jb text-ash">
                  {p.n} · {p.label}
                </span>
                <span className="font-display mt-6 text-3xl font-medium tracking-tight text-bone md:text-4xl">
                  {p.title}
                </span>
                <span className="mt-3 max-w-sm text-[14px] leading-relaxed text-mist">{p.copy}</span>
                <span className="micro-label mt-8 inline-flex items-center gap-2 font-mono-jb text-mist transition-colors duration-300 group-hover:text-bone">
                  <span className="text-blood transition-transform duration-300 group-hover:translate-x-1">→</span>
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

        {/* ---- 07 · FINAL CTA ---- */}
        <section id="closing" className="relative scroll-mt-16 overflow-hidden border-t border-hairline px-5 py-32 text-center md:px-10 md:py-44">
          <Reveal>
            <p className="micro-label font-mono-jb text-ash">[07] / PROTOCOL</p>
            <h2 className="font-display mx-auto mt-8 max-w-4xl text-[clamp(36px,7vw,96px)] leading-[0.95] font-normal tracking-tight">
              Berhenti transfer ke orang asing.
            </h2>
            <p className="mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-mist md:text-[17px]">
              Pembayaran terlindungi escrow di Stellar. Untuk pembeli dan seller yang bertemu di feed, bukan di toko.
            </p>
            <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/buyer"
                className="micro-label bg-bone px-8 py-4 font-mono-jb text-void transition-colors duration-300 hover:bg-blood hover:text-bone"
              >
                Saya Pembeli
              </Link>
              <Link
                href="/seller/login"
                className="micro-label border border-hairline px-8 py-4 font-mono-jb text-bone transition-colors duration-300 hover:border-blood hover:text-blood"
              >
                Mulai Jualan
              </Link>
            </div>
          </Reveal>
        </section>

        <footer className="flex flex-col items-start justify-between gap-4 border-t border-hairline px-5 py-8 md:flex-row md:items-center md:px-10">
          <div className="flex items-baseline">
            <span className="font-display font-medium text-bone">TRUSTIP</span>
            <span className="font-display font-medium text-blood">.</span>
            <span className="micro-label ml-3 font-mono-jb text-ash">Stellar native · USDC · Soroban escrow</span>
          </div>
          <span className="micro-label font-mono-jb text-ash">© {new Date().getFullYear()} TRUSTIP</span>
        </footer>
      </main>
    </div>
  );
}
