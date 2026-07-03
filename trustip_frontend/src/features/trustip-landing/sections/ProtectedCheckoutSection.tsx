"use client"

import { useRef, useState } from "react"
import { motion, useReducedMotion, useScroll } from "framer-motion"
import { StickyScene } from "../motion/StickyScene"
import { KineticWords } from "../motion/KineticWords"
import { RouteGate } from "../motion/RouteGate"
import { WalletCTAButton } from "../components/WalletCTAButton"
import { OrderRail } from "../components/OrderRail"
import { MetaCluster } from "../components/MetaCluster"
import { MOCK_ORDER, MOCK_WALLETS } from "../data/landing-content"
import { EASE, fadeUp, staggerContainer } from "../motion/motion-presets"

const GATE_STAGES = [
  { id: "link", label: "CHECKOUT LINK" },
  { id: "verify", label: "BACKEND VERIFY (DEMO)" },
  { id: "escrow", label: "SOROBAN ESCROW CONTRACT" },
] as const

type FlowPhase = "idle" | "connecting" | "connected" | "paying" | "locked"

export function ProtectedCheckoutSection() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [phase, setPhase] = useState<FlowPhase>("idle")
  const [railIndex, setRailIndex] = useState(2)
  const reduce = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress: gateProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.8", "start 0.15"],
  })

  // Mock state machine — front-end only, no wallet SDK, no network.
  const step = phase === "idle" ? 0 : phase === "connecting" || phase === "connected" ? 1 : 2
  const connected = phase === "connected" || phase === "paying" || phase === "locked"

  const connectMock = (id: string) => {
    console.warn("[MOCK] Wallet connect — no real wallet SDK")
    setWallet(id)
    setPhase("connecting")
    setTimeout(() => setPhase("connected"), 700)
  }

  const payMock = () => {
    if (phase !== "connected") return
    console.warn("[MOCK] Payment preview — no real transaction")
    setPhase("paying")
    setTimeout(() => {
      setPhase("locked")
      setRailIndex(1)
    }, 1100)
  }

  const resetMock = () => {
    setWallet(null)
    setPhase("idle")
    setRailIndex(2)
  }

  return (
    <section
      ref={sectionRef}
      id="checkout"
      className="relative w-full overflow-hidden border-t border-[rgba(237,234,227,0.08)] py-16 md:py-24 lg:pl-32"
      style={{ scrollMarginTop: "60px" }}
    >
      {/* Cropped ghost numeral — right edge */}
      <span
        aria-hidden
        className="hidden md:block absolute -right-8 top-20 z-0 font-display font-light leading-none text-[rgba(237,234,227,0.035)] select-none pointer-events-none"
        style={{ fontSize: "clamp(160px, 22vw, 380px)" }}
      >
        03
      </span>

      {/* Opener */}
      <div className="relative z-10 px-5 md:px-10 mb-10 md:mb-16 max-w-3xl">
        <motion.div
          className="flex items-center gap-3 mb-10"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8]">
            [03]
          </span>
          <span className="h-px w-8 bg-[rgba(237,234,227,0.08)]" />
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8]">
            Review and pay
          </span>
        </motion.div>

        <KineticWords
          as="p"
          text="A protected link is not a normal checkout."
          className="font-display font-normal text-[clamp(36px,7vw,96px)] text-[#EDEAE3] leading-[0.92] tracking-[-0.03em]"
          />
      </div>

      {/* Connector thread — carries the eye from the headline down into the card */}
      <div aria-hidden className="relative z-10 flex flex-col items-center -mt-2 mb-2">
        <motion.div
          className="w-px h-16 md:h-24 origin-top"
          style={{
            scaleY: gateProgress,
            background:
              "linear-gradient(180deg, rgba(237,234,227,0.05) 0%, rgba(255,45,0,0.55) 100%)",
          }}
        />
        <motion.span
          className="mt-1.5 font-mono-jb text-[8px] uppercase tracking-[0.3em] text-[#C6C2B8]/50"
          style={{ opacity: gateProgress }}
        >
          LINK ENTERS THE MACHINE
        </motion.span>
      </div>

      {/* Sticky checkout card — a passage through layered gates */}
      <StickyScene height="150vh">
        <div className="relative w-full h-full flex items-center">
          {/* Entry route — the link entering the machine */}
          <div
            aria-hidden
            className="absolute left-1/2 top-0 h-[14vh] w-px pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, transparent 0%, rgba(237,234,227,0.12) 30%, rgba(255,45,0,0.5) 100%)",
            }}
          >
            {!reduce && (
              <motion.span
                className="absolute -left-[2.5px] w-[6px] h-[6px] rounded-full bg-[#FF2D00]"
                animate={{ top: ["0%", "96%"], opacity: [0, 1, 0.2] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeIn" }}
              />
            )}
          </div>

          {/* Left gutter — vertical gate label (xl+) */}
          <span
            aria-hidden
            className="hidden xl:block absolute left-6 top-1/2 -translate-y-1/2 font-mono-jb text-[8px] uppercase tracking-[0.4em] text-[#C6C2B8]/35 pointer-events-none select-none"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          >
            [ LINK · VERIFY · PROTECT (DEMO) ]
          </span>

          {/* Right gutter — chamber metadata (xl+) */}
          <div aria-hidden className="hidden xl:block absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none">
            <MetaCluster
              align="right"
              rows={[
                { label: "CHAMBER", value: "CHECKOUT" },
                { label: "GATES", value: "3 STAGED" },
                { label: "STATE", value: "PREVIEW", accent: true },
              ]}
            />
          </div>

          <div className="w-full max-w-3xl mx-auto px-5">
            <div className="relative">
              {/* Layered gate frames behind the card */}
              <div
                aria-hidden
                className="hidden md:block absolute -inset-3 border border-[rgba(237,234,227,0.06)] pointer-events-none"
              />
              <div
                aria-hidden
                className="hidden md:block absolute -inset-6 border border-[rgba(237,234,227,0.04)] pointer-events-none"
              >
                <span className="absolute top-0 left-0 w-0 h-0 crosshair-tl" />
                <span className="absolute top-0 right-0 w-0 h-0 crosshair-tr" />
                <span className="absolute bottom-0 left-0 w-0 h-0 crosshair-bl" />
                <span className="absolute bottom-0 right-0 w-0 h-0 crosshair-br" />
              </div>

              <div className="relative border border-[rgba(237,234,227,0.08)] bg-[#0A0A0A]">
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-[rgba(237,234,227,0.08)] px-5 md:px-7 py-4">
              <div className="flex items-center gap-3">
                <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8]">
                  [ORDER {MOCK_ORDER.code}]
                </span>
                <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#FF2D00] border border-[#FF2D00]/30 px-2 py-0.5">
                  DEMO
                </span>
              </div>
              <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#FF2D00] flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[#FF2D00]" />
                PROTECTED CHECKOUT PREVIEW
              </div>
            </div>

            {/* Link → verify → escrow staged passage */}
            <div className="border-b border-[rgba(237,234,227,0.08)]">
              <RouteGate stages={GATE_STAGES} progress={gateProgress} />
              <div className="px-5 md:px-7 pb-3 -mt-1 font-mono-jb text-[9px] text-[#C6C2B8]/50 truncate">
                trustip.link/{MOCK_ORDER.seller.replace("@", "")}/{MOCK_ORDER.code}
              </div>
            </div>

            {/* Card body */}
            <div className="px-5 md:px-7 py-7 md:py-9">
              {/* Seller info */}
              <motion.div
                className="mb-8"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8] mb-2">
                  SELLER
                </div>
                <div className="group flex items-baseline gap-3 flex-wrap cursor-default" data-cursor="TRUST">
                  <span className="font-display font-medium text-[clamp(24px,4vw,52px)] text-[#EDEAE3] leading-[1.04]">
                    {MOCK_ORDER.seller}
                  </span>
                  <span className="relative font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8] transition-colors duration-300 group-hover:text-[#FF2D00]">
                    TRUST PROFILE · {MOCK_ORDER.sellerRating} ★ (DEMO)
                    <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#FF2D00] transition-all duration-500 group-hover:w-full" />
                  </span>
                </div>
                <p className="mt-3 font-body text-[15px] text-[#C6C2B8] max-w-md">
                  {MOCK_ORDER.sellerTx} protected transactions completed. Refund rate 1.8%.
                </p>
              </motion.div>

              {/* Item + price grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 border-t border-[rgba(237,234,227,0.08)] pt-7">
                <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                  <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8] mb-2">
                    ITEM
                  </div>
                  <div className="font-display font-normal text-[clamp(17px,1.4vw,21px)] text-[#EDEAE3]">
                    {MOCK_ORDER.item}
                  </div>
                  <div className="font-body text-[15px] text-[#C6C2B8] mt-1">
                    {MOCK_ORDER.size}
                  </div>
                </motion.div>
                <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                  <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8] mb-2">
                    PRICE (DEMO)
                  </div>
                  <div className="font-display font-medium text-[clamp(36px,7vw,96px)] text-[#EDEAE3] leading-[0.92]">
                    {MOCK_ORDER.amount}
                  </div>
                  <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#FF2D00] mt-1">
                    {MOCK_ORDER.network}
                  </div>
                </motion.div>
              </div>

              {/* USDC payment requirement */}
              <div className="flex items-center gap-3 border-t border-[rgba(237,234,227,0.08)] pt-7 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EDEAE3] shrink-0" />
                <p className="font-mono-jb text-[10px] uppercase tracking-[0.18em] text-[#C6C2B8]">
                  Accepted: USDC on Stellar, via Freighter or xBull. No bank transfer, no QRIS
                </p>
              </div>

              {/* Protection terms */}
              <div className="border-t border-[rgba(237,234,227,0.08)] pt-7 mb-8">
                <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8] mb-3">
                  PROTECTION (DEMO)
                </div>
                <p className="font-body text-[15px] text-[#EDEAE3]/80">
                  Funds are held safely the moment payment is confirmed, and stay
                  locked until the order is received. The buyer can request a review within{" "}
                  {MOCK_ORDER.protection}.
                </p>
              </div>

              {/* Mock wallet connect */}
              <div className="mb-8">
                <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8] mb-3">
                  CONNECT WALLET (DEMO)
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {MOCK_WALLETS.map((w) => (
                    <button
                      key={w.id}
                      data-cursor="CONNECT"
                      onClick={() => connectMock(w.id)}
                      className={`group flex flex-col items-center justify-center gap-1.5 px-4 py-4 border transition-all duration-300 ${
                        wallet === w.id
                          ? "border-[#FF2D00] bg-[#0A0A0A]"
                          : "border-[rgba(237,234,227,0.08)] hover:border-[#EDEAE3]/40"
                      }`}
                    >
                      <span
                        className={`grid place-items-center w-6 h-6 border text-[11px] leading-none transition-colors duration-300 ${
                          wallet === w.id ? "border-[#FF2D00] text-[#FF2D00]" : "border-[#C6C2B8]/30 text-[#C6C2B8] group-hover:border-[#C6C2B8]/60"
                        }`}
                        aria-hidden
                      >
                        ◈
                      </span>
                      <div className="font-display font-medium text-[15px] text-[#EDEAE3]">
                        {w.name}
                      </div>
                      <motion.div
                        key={wallet === w.id ? phase : "net"}
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`font-mono-jb text-[9px] uppercase tracking-[0.22em] ${
                          wallet === w.id && connected
                            ? "text-[#FF2D00]"
                            : wallet === w.id && phase === "connecting"
                              ? "text-[#EDEAE3]/70"
                              : "text-[#C6C2B8]"
                        }`}
                      >
                        {wallet === w.id
                          ? connected
                            ? "● CONNECTED (DEMO)"
                            : "CONNECTING…"
                          : w.network}
                      </motion.div>
                    </button>
                  ))}
                </div>
                <div className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#FF2D00]/60 mt-2">
                  * No real wallet SDK — visual preview only
                </div>
              </div>

              {/* Mock step readout — compact strip, replaces the old floating widget */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-4 font-mono-jb text-[8px] uppercase tracking-[0.2em]">
                {["CREATED (DEMO)", "WALLET (DEMO)", "LOCKED · PREVIEW"].map((label, i) => (
                  <span
                    key={label}
                    className={`flex items-center gap-1.5 transition-colors duration-500 ${
                      step >= i ? "text-[#FF2D00]" : "text-[#C6C2B8]/40"
                    }`}
                  >
                    <span
                      className={`w-1 h-1 rounded-full ${
                        step >= i ? "bg-[#FF2D00]" : "bg-[rgba(237,234,227,0.15)]"
                      }`}
                    />
                    {label}
                  </span>
                ))}
              </div>

              {/* Checkout CTA — morphs through the mock flow */}
              <motion.button
                data-cursor={phase === "connected" ? "PAY" : "OPEN"}
                disabled={phase !== "connected"}
                onClick={payMock}
                animate={{
                  borderColor:
                    phase === "locked"
                      ? "rgba(255,45,0,0.9)"
                      : connected
                        ? "rgba(255,45,0,0.8)"
                        : "rgba(237,234,227,0.08)",
                  backgroundColor: phase === "locked" ? "rgba(255,45,0,0.06)" : "rgba(0,0,0,0)",
                  opacity: phase === "idle" ? 0.4 : 1,
                }}
                transition={{ duration: 0.5, ease: EASE }}
                className={`group w-full flex items-center justify-between px-6 py-5 border ${
                  phase === "connected" ? "hover:bg-[#101010] cursor-pointer shadow-blood" : ""
                } ${phase === "idle" ? "cursor-not-allowed" : ""}`}
              >
                <motion.span
                  key={phase}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#EDEAE3]"
                >
                  {phase === "idle" && "Connect a wallet to continue"}
                  {phase === "connecting" && "Connecting… (DEMO)"}
                  {phase === "connected" && `Pay ${MOCK_ORDER.amount} USDC (DEMO)`}
                  {phase === "paying" && "Confirming payment… (DEMO)"}
                  {phase === "locked" && "● Funds protected (DEMO)"}
                </motion.span>
                <span className="font-mono-jb text-[#FF2D00]">
                  {phase === "locked" ? "LOCKED ✓ (SIM)" : `${MOCK_ORDER.amount} USDC (DEMO) →`}
                </span>
              </motion.button>

              {/* Simulation controls — appear once the mock escrow locks */}
              {phase === "locked" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="mt-4 flex flex-wrap items-center gap-3"
                >
                  <button
                    data-cursor="STEP"
                    onClick={() => setRailIndex((i) => Math.min(i + 1, 5))}
                    className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#EDEAE3] border border-[rgba(237,234,227,0.18)] hover:border-[#FF2D00] px-4 py-2 transition-colors duration-300"
                  >
                    Advance order
                  </button>
                  <button
                    data-cursor="RESET"
                    onClick={resetMock}
                    className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#C6C2B8] hover:text-[#EDEAE3] px-2 py-2 transition-colors duration-300"
                  >
                    Reset demo
                  </button>
                  <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#FF2D00]/60">
                    DEMO · DRAG THE TIMELINE BELOW
                  </span>
                </motion.div>
              )}
              </div>
              </div>
            </div>
          </div>
        </div>
      </StickyScene>

      {/* Order rail — the cinematic protection sequence (all states simulated) */}
      <div className="relative z-10 px-5 md:px-10 mt-8 md:mt-10">
        <OrderRail activeIndex={railIndex} onSelect={setRailIndex} />
      </div>
    </section>
  )
}
