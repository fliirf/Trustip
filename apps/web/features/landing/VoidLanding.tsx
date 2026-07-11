/* The Trustip VOID landing, composed as six chapters rather than six sections.

   BEGINNING  hero          editorial, near-empty, the Core floating
   CONFLICT   ConflictScene scattered fragments converging under scroll
   THESIS     ManifestoPan  full-viewport typography, panned sideways
   PROTOCOL   ProtocolScene one Escrow Core, pinned, scrubbed
   PROOF      ProofDocument dense technical document with sticky marginalia
   PLATFORM   PlatformSplit asymmetric code split, real contract source
   ACTION     closing       massive type, one Core, one button

   No two consecutive chapters share a structure, an alignment, a density, or a
   scroll axis. Every CTA routes into the real product; nothing here simulates a
   payment. The only client islands are the three scenes and the magnetic CTAs. */

import Link from "next/link";
import { CameraRig } from "./CameraRig";
import { ConflictScene } from "./ConflictScene";
import { HeroMotion } from "./HeroMotion";
import { ManifestoPan } from "./ManifestoPan";
import { PlatformSplit } from "./PlatformSplit";
import { ProofDocument } from "./ProofDocument";
import { ProtocolScene } from "./ProtocolScene";
import { Reveal } from "./Reveal";
import { SplitWords } from "./SplitWords";
import { WorldLayers } from "./WorldLayers";
import { displayFont, monoFont } from "./fonts";

/* Server-rendered per-character boot spans for the wordmark (CSS staggered). */
function BootChars({ text, start, step = 0.05 }: { text: string; start: number; step?: number }) {
  return (
    <>
      {[...text].map((ch, i) => (
        <span
          key={i}
          className="boot-char"
          style={{ animationDelay: `${(start + i * step).toFixed(2)}s` }}
        >
          {ch}
        </span>
      ))}
    </>
  );
}

/* Wayfinding speaks the reader's language; the chapters underneath keep their
   instrument identity. FAQ is a real route, not an anchor. */
const NAV = [
  { href: "#conflict", label: "MASALAH" },
  { href: "#protocol", label: "CARA KERJA" },
  { href: "#proof", label: "BUKTI" },
  { href: "#platform", label: "TEKNOLOGI" },
  { href: "/faq", label: "FAQ" },
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

/* The three real failure cases, set as a staircase rather than a card row: each
   steps further right than the last, so the eye falls down and across instead of
   scanning three equal boxes. */
const RISK_CASES = [
  {
    platform: "INSTAGRAM",
    scenario: "Jastip pre-order",
    risk: "Transfer duluan, chat dihapus. Tidak ada jejak, tidak ada perlindungan.",
    indent: "md:ml-0",
  },
  {
    platform: "TIKTOK",
    scenario: "Group buy",
    risk: "Sepuluh pembeli patungan. Organizer hilang setelah dana terkumpul.",
    indent: "md:ml-[22%]",
  },
  {
    platform: "WHATSAPP",
    scenario: "Barang second",
    risk: "DP 50% dibayar. Barang tidak pernah dikirim. Tanpa tracking.",
    indent: "md:ml-[44%]",
  },
] as const;

export function VoidLanding() {
  return (
    <div className={`${displayFont.variable} ${monoFont.variable} landing-root relative bg-void text-bone`}>
      {/* The world: ambient wash, three lights, protocol grid, two dust fields,
          telemetry. Rendered once, never unmounted, so no chapter can restart the
          atmosphere it inherits. */}
      <WorldLayers />
      {/* The one Escrow Core, for the whole page. Mounted here, never remounted:
          every chapter below frames this same object. The rig also drives the
          lights, the grid and the spine. */}
      <CameraRig />
      <div className="grain-overlay" aria-hidden />

      {/* Phase 20: the bar was ~48px (py-3, 18px wordmark) and read as thin and
          weak. Lifted to ~66px with a larger wordmark, more menu rhythm, and a
          clearer two-tier action hierarchy (bright buyer link + standing seller
          key). Still floating and minimal — height and balance only, no redesign. */}
      <header className="engraved-b fixed inset-x-0 top-0 z-50 bg-void/85 backdrop-blur-sm">
        <div className="flex items-center justify-between px-5 py-4 md:px-10 md:py-[18px]">
          <a href="#hero" className="flex items-baseline">
            <span className="font-display text-xl font-medium tracking-tight text-bone">TRUSTIP</span>
            <span className="font-display text-xl font-medium text-blood">.</span>
          </a>
          <nav className="hidden items-center gap-7 md:flex lg:gap-9" aria-label="Section">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="micro-label font-mono-jb text-ash transition-colors duration-300 hover:text-bone"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-5">
            {/* Buyer is the primary funnel (mirrors the hero's illuminated CTA),
                so it reads at full bone here, not the dimmer mist it was. */}
            <Link href="/buyer" className="micro-label font-mono-jb text-bone transition-colors hover:text-blood">
              Saya Pembeli
            </Link>
            <Link
              href="/seller/login"
              className="micro-label cta-ghost mat-key border border-hairline px-4 py-2.5 font-mono-jb text-bone transition-colors duration-300 hover:border-blood hover:text-blood"
            >
              Mulai Jualan
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* ============ 01 · BEGINNING ============
            Almost nothing: a corner coordinate, the wordmark, one line, two
            actions. The Core floats behind at full bleed. Everything that used to
            crowd this viewport (the boot meta strip, the value paragraph) has been
            pushed into the chapters that earn it. */}
        <HeroMotion>
          <section id="hero" className="relative flex min-h-[100svh] flex-col overflow-hidden">
            {/* No Core here. The Core is already on screen, held by the rig. */}
            <div className="relative z-10 flex items-start justify-between px-5 pt-24 md:px-10">
              <span className="boot-label micro-label font-mono-jb text-ash" style={{ animationDelay: "0.05s" }}>
                [01] / Protected Checkout
              </span>
              <span
                className="boot-label micro-label hidden font-mono-jb text-ash md:block"
                style={{ animationDelay: "0.12s" }}
              >
                STELLAR NATIVE · USDC
              </span>
            </div>

            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 text-center">
              <h1
                className="font-display text-[clamp(56px,15vw,220px)] leading-none font-medium tracking-tight"
                aria-label="TRUSTIP."
              >
                <span aria-hidden>
                  <BootChars text="TRUSTIP" start={0.35} />
                  <span className="boot-char text-blood" style={{ animationDelay: "0.7s" }}>
                    .
                  </span>
                </span>
              </h1>

              <div className="boot-line relative mt-8 max-w-2xl md:mt-12" style={{ animationDelay: "0.9s" }}>
                {/* The promise leads in the reader's own language; the mechanism
                    (tagline B) is still human. The tech stays in the corner
                    micro-labels and the marquee, where metadata belongs. */}
                <p className="hero-tagline-a font-display text-[clamp(24px,4vw,52px)] leading-[1.06] font-normal tracking-tight text-bone">
                  Pembayaran kamu tetap aman sampai pesanan diterima.
                </p>
                <p
                  aria-hidden
                  className="hero-tagline-b font-display absolute inset-0 text-[clamp(24px,4vw,52px)] leading-[1.06] font-normal tracking-tight text-bone opacity-0"
                >
                  Dana berpindah hanya setelah kamu mengonfirmasi.
                </p>
              </div>

              <div
                className="boot-line mt-14 flex flex-col items-center gap-4 sm:flex-row md:mt-20"
                style={{ animationDelay: "1.05s" }}
              >
                <Link
                  href="/buyer"
                  className="micro-label cta-primary mat-illuminated inline-block bg-bone px-8 py-4 font-mono-jb text-void transition-colors duration-300 hover:bg-blood hover:text-bone"
                >
                  Saya Pembeli
                </Link>
                <Link
                  href="/seller/login"
                  className="micro-label cta-ghost mat-key inline-block border border-hairline px-8 py-4 font-mono-jb text-bone transition-colors duration-300 hover:border-blood hover:text-blood"
                >
                  Mulai Jualan
                </Link>
              </div>
            </div>

            <div className="engraved-t relative z-10 overflow-hidden py-4">
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
        </HeroMotion>

        {/* ============ 02 · CONFLICT ============ */}
        <ConflictScene />

        {/* Coda to the conflict chapter: the three real cases, stepped down and
            across. No container, no hairline box, no equal columns. */}
        <section className="px-5 pb-32 md:px-10 md:pb-48">
          <Reveal className="mx-auto w-full max-w-[1400px]">
            {RISK_CASES.map((c, i) => (
              <div
                key={c.platform}
                className={`max-w-md py-10 md:py-14 ${c.indent}`}
                data-rv="rise"
                style={{ transitionDelay: `${i * 140}ms` }}
              >
                <span className="micro-label font-mono-jb text-blood/70">{c.platform}</span>
                <div className="font-display mt-4 text-[clamp(22px,2.6vw,34px)] leading-tight font-normal tracking-tight text-bone">
                  {c.scenario}
                </div>
                <p className="mt-3 text-[14px] leading-relaxed text-mist">{c.risk}</p>
              </div>
            ))}
          </Reveal>
        </section>

        {/* ============ 03 · THESIS ============ */}
        <ManifestoPan />

        {/* ============ 04 · PROTOCOL ============ */}
        <ProtocolScene />

        {/* ============ 05 · PROOF + 06 · PLATFORM ============
            One hairline spine runs through both. It is a single element: the Proof
            rail hangs its states off it, the Platform code block starts flush
            against it, and CameraRig draws it downward as the reader descends. The
            chapter boundary between them has no rule of its own to announce it. */}
        <div data-spine-wrap className="relative px-5 md:px-10">
          <div className="relative mx-auto max-w-[1400px]">
            <span aria-hidden data-spine className="landing-spine absolute inset-y-0 left-0 w-px bg-hairline" />
            <ProofDocument />
            <PlatformSplit />
          </div>
        </div>

        {/* ============ 07 · ACTION ============
            The emptiest viewport on the page. One Core, one sentence, one button,
            one text link out. Nothing to read, nothing to compare. */}
        <section
          id="closing"
          className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-5 text-center md:px-10"
        >
          {/* No Core here either: the rig has already dimmed the same object down
              to an aura behind this frame. The scrim keeps its orbiting particles
              off the headline's descenders so the type stays the subject. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{ background: "radial-gradient(closest-side at 50% 50%, #050505 38%, transparent 78%)" }}
          />

          <Reveal className="relative z-10">
            {/* The spine, re-entering the frame. Same 1px hairline, now vertical
                through the CTA: the rule the reader followed down the document
                terminates on the button. */}
            <span
              aria-hidden
              data-spine-tail
              className="landing-spine mx-auto mb-16 block h-[9vh] w-px bg-hairline"
            />
            <h2
              className="font-display mx-auto max-w-5xl text-[clamp(40px,8vw,120px)] leading-[0.92] font-normal tracking-tight"
              aria-label="Berhenti transfer ke orang asing."
            >
              <SplitWords text="Berhenti transfer ke orang asing." step={65} />
            </h2>

            <div
              className="mt-20 flex flex-col items-center gap-8"
              data-rv="rise"
              style={{ transitionDelay: "420ms" }}
            >
              <Link
                href="/seller/login"
                className="micro-label cta-primary mat-illuminated inline-block bg-bone px-10 py-5 font-mono-jb text-void transition-colors duration-300 hover:bg-blood hover:text-bone"
              >
                Mulai Jualan
              </Link>
              <Link
                href="/buyer"
                className="micro-label cta-ghost pb-1 font-mono-jb text-mist transition-colors duration-300 hover:text-bone"
              >
                Saya Pembeli
              </Link>
            </div>
          </Reveal>
        </section>

        <footer className="engraved-t flex flex-col items-start justify-between gap-4 px-5 py-8 md:flex-row md:items-center md:px-10">
          <div className="flex items-baseline">
            <span className="font-display font-medium text-bone">TRUSTIP</span>
            <span className="font-display font-medium text-blood">.</span>
            <span className="micro-label ml-3 font-mono-jb text-ash">Stellar native · USDC · Soroban escrow</span>
          </div>
          <nav className="flex items-center gap-5" aria-label="Bantuan">
            <Link href="/cara-kerja" className="micro-label font-mono-jb text-ash transition-colors hover:text-bone">
              Cara Kerja
            </Link>
            <Link href="/faq" className="micro-label font-mono-jb text-ash transition-colors hover:text-bone">
              FAQ
            </Link>
          </nav>
          <span className="micro-label font-mono-jb text-ash">© {new Date().getFullYear()} TRUSTIP</span>
        </footer>
      </main>
    </div>
  );
}
