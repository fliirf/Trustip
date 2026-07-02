"use client"

import { useRef, useState } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { StickyScene } from "../motion/StickyScene"
import { WalletCTAButton } from "../components/WalletCTAButton"
import { MOCK_ORDER, MOCK_WALLETS } from "../data/landing-content"
import { EASE, fadeUp, staggerContainer } from "../motion/motion-presets"

export function ProtectedCheckoutSection() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [step, setStep] = useState(0)

  const connectMock = (id: string) => {
    console.warn("[MOCK] Wallet connect — no real wallet SDK")
    setWallet(id)
    setTimeout(() => setStep(1), 500)
    setTimeout(() => setStep(2), 1200)
    setTimeout(() => setStep(3), 2000)
  }

  return (
    <section
      id="checkout"
      className="relative w-full overflow-hidden border-t border-[rgba(255,255,255,0.08)] py-24 md:py-36 lg:pl-32"
      style={{ scrollMarginTop: "60px" }}
    >
      {/* Opener */}
      <div className="relative z-10 px-5 md:px-10 mb-16 md:mb-28 max-w-3xl">
        <motion.div
          className="flex items-center gap-3 mb-10"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            [03]
          </span>
          <span className="h-px w-8 bg-[rgba(255,255,255,0.08)]" />
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            Protected Checkout — Review & Connect
          </span>
        </motion.div>

        <motion.p
          className="font-display font-normal text-[clamp(36px,7vw,96px)] text-[#F7F8FA] leading-[0.92] tracking-[-0.03em]"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          A protected link is not a normal checkout.
        </motion.p>
      </div>

      {/* Sticky checkout card */}
      <StickyScene height="180vh">
        <div className="w-full max-w-3xl mx-auto px-5">
          <div className="border border-[rgba(255,255,255,0.08)] bg-[#0D1018]">
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-5 md:px-7 py-4">
              <div className="flex items-center gap-3">
                <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
                  [ORDER {MOCK_ORDER.code}]
                </span>
                <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#16C784] border border-[#16C784]/30 px-2 py-0.5">
                  DEMO
                </span>
              </div>
              <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#16C784] flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[#16C784]" />
                PROTECTED CHECKOUT PREVIEW
              </div>
            </div>

            {/* Link → escrow contract morph strip */}
            <div className="flex items-stretch border-b border-[rgba(255,255,255,0.08)] font-mono-jb text-[10px] uppercase tracking-[0.18em]">
              <div className="flex-1 px-5 md:px-7 py-3 text-[#A6ADBB] truncate">
                trustip.link/{MOCK_ORDER.seller.replace("@", "")}/{MOCK_ORDER.code}
              </div>
              <motion.div
                className="grid place-items-center px-3 text-[#16C784] border-x border-[rgba(255,255,255,0.08)]"
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                →
              </motion.div>
              <div className="flex items-center gap-2 px-5 md:px-7 py-3 text-[#16C784]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16C784]" />
                SOROBAN ESCROW CONTRACT
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
                <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-2">
                  SELLER
                </div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-display font-medium text-[clamp(24px,4vw,52px)] text-[#F7F8FA] leading-[1.04]">
                    {MOCK_ORDER.seller}
                  </span>
                  <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
                    TRUST PROFILE · {MOCK_ORDER.sellerRating} ★ (DEMO)
                  </span>
                </div>
                <p className="mt-3 font-body text-[15px] text-[#A6ADBB] max-w-md">
                  {MOCK_ORDER.sellerTx} protected transactions completed. Refund rate 1.8%.
                </p>
              </motion.div>

              {/* Item + price grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 border-t border-[rgba(255,255,255,0.08)] pt-7">
                <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                  <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-2">
                    ITEM
                  </div>
                  <div className="font-display font-normal text-[clamp(17px,1.4vw,21px)] text-[#F7F8FA]">
                    {MOCK_ORDER.item}
                  </div>
                  <div className="font-body text-[15px] text-[#A6ADBB] mt-1">
                    {MOCK_ORDER.size}
                  </div>
                </motion.div>
                <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                  <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-2">
                    PRICE (DEMO)
                  </div>
                  <div className="font-display font-medium text-[clamp(36px,7vw,96px)] text-[#F7F8FA] leading-[0.92]">
                    {MOCK_ORDER.amount}
                  </div>
                  <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#16C784] mt-1">
                    {MOCK_ORDER.network}
                  </div>
                </motion.div>
              </div>

              {/* USDC payment requirement */}
              <div className="flex items-center gap-3 border-t border-[rgba(255,255,255,0.08)] pt-7 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4F8CFF] shrink-0" />
                <p className="font-mono-jb text-[10px] uppercase tracking-[0.18em] text-[#A6ADBB]">
                  Accepted: USDC on Stellar only, via Freighter or xBull — no bank transfer, no QRIS
                </p>
              </div>

              {/* Protection terms */}
              <div className="border-t border-[rgba(255,255,255,0.08)] pt-7 mb-8">
                <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-3">
                  PROTECTION (DEMO)
                </div>
                <p className="font-body text-[15px] text-[#F7F8FA]/80">
                  Funds lock in a Soroban escrow contract after on-chain confirmation, and
                  stay locked until the order is received. Buyer can request review within{" "}
                  {MOCK_ORDER.protection}.
                </p>
              </div>

              {/* Mock wallet connect */}
              <div className="mb-8">
                <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-3">
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
                          ? "border-[#16C784] bg-[#0D1018]"
                          : "border-[rgba(255,255,255,0.08)] hover:border-[#F7F8FA]/40"
                      }`}
                    >
                      <span
                        className={`grid place-items-center w-6 h-6 border text-[11px] leading-none transition-colors duration-300 ${
                          wallet === w.id ? "border-[#16C784] text-[#16C784]" : "border-[#A6ADBB]/30 text-[#A6ADBB] group-hover:border-[#A6ADBB]/60"
                        }`}
                        aria-hidden
                      >
                        ◈
                      </span>
                      <div className="font-display font-medium text-[15px] text-[#F7F8FA]">
                        {w.name}
                      </div>
                      <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB]">
                        {w.network}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#16C784]/60 mt-2">
                  * No real wallet SDK — visual preview only
                </div>
              </div>

              {/* Checkout CTA */}
              <button
                data-cursor="PAY"
                disabled={!wallet}
                className={`group w-full flex items-center justify-between px-6 py-5 border transition-all duration-500 ${
                  wallet
                    ? "border-[#16C784] hover:bg-[#121722] cursor-pointer"
                    : "border-[rgba(255,255,255,0.08)] opacity-40 cursor-not-allowed"
                }`}
              >
                <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#F7F8FA]">
                  {wallet ? "Preview Payment → Escrow Lock (DEMO)" : "Connect wallet to continue"}
                </span>
                <span className="font-mono-jb text-[#16C784]">
                  {MOCK_ORDER.amount} USDC (DEMO) →
                </span>
              </button>
            </div>
          </div>
        </div>
      </StickyScene>

      {/* Step indicator */}
      <div className="relative z-10 px-5 md:px-10 mt-16 max-w-3xl mx-auto">
        <div className="border border-[rgba(255,255,255,0.08)] bg-[#0D1018] p-6">
          <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-4">
            ESCROW STATUS PROGRESSION (DEMO)
          </div>
          {[
            { id: "created", label: "CREATED (DEMO)", en: "Checkout link opened" },
            { id: "wallet", label: "WALLET CONNECTED (DEMO)", en: "Buyer previewed wallet" },
            { id: "funded", label: "LOCKED (DEMO) · BACKEND CONFIRMED PREVIEW", en: "Funds would lock after on-chain confirmation" },
          ].map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 py-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  step >= i ? "bg-[#16C784]" : "bg-[rgba(255,255,255,0.15)]"
                }`}
              />
              <span
                className={`font-mono-jb text-[10px] uppercase tracking-[0.22em] ${
                  step >= i ? "text-[#F7F8FA]" : "text-[#A6ADBB]/40"
                }`}
              >
                {s.label}
              </span>
              <span className="font-body text-[12px] text-[#A6ADBB] ml-auto hidden sm:block">
                {s.en}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
