"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { KineticWords } from "../motion/KineticWords"
import { ConvergenceField } from "../motion/ConvergenceField"
import { WalletCTAButton } from "../components/WalletCTAButton"
import { CTAButton } from "../components/CTAButton"
import { Marquee } from "@/components/void/marquee"
import { CHANNEL_MARQUEE_ITEMS } from "../data/landing-content"
import { EASE } from "../motion/motion-presets"

export function FinalCTASection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  })

  const textY = useTransform(scrollYProgress, [0, 1], [60, -20])

  return (
    <section
      ref={ref}
      className="relative w-full overflow-hidden border-t border-[rgba(237,234,227,0.08)] py-24 md:py-36 lg:pl-32"
    >
      {/* Ghost word */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 select-none"
        aria-hidden
      >
        <span
          className="font-display font-light leading-none text-[rgba(237,234,227,0.03)]"
          style={{ fontSize: "clamp(200px, 28vw, 480px)" }}
        >
          TRUSTIP
        </span>
      </div>

      {/* Convergence — every route line the page has traced collapses to one resolved point */}
      <ConvergenceField
        progress={scrollYProgress}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 w-[80vw] h-[80vw] max-w-[760px] max-h-[760px]"
      />

      {/* Closing editorial frame — the final plate (md+) */}
      <div
        aria-hidden
        className="hidden md:block absolute inset-6 lg:inset-10 border border-[rgba(237,234,227,0.05)] pointer-events-none z-0"
      >
        <span className="absolute top-0 left-0 w-0 h-0 crosshair-tl" />
        <span className="absolute top-0 right-0 w-0 h-0 crosshair-tr" />
        <span className="absolute bottom-0 left-0 w-0 h-0 crosshair-bl" />
        <span className="absolute bottom-0 right-0 w-0 h-0 crosshair-br" />
      </div>

      {/* Ghost orbit fragments cropped at the page's end — the reference's closing "O"s */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[40vh] overflow-hidden pointer-events-none z-0">
        <span className="absolute -bottom-[55%] left-[8%] w-[38vw] aspect-square rounded-full border border-[rgba(237,234,227,0.05)]" />
        <span className="absolute -bottom-[70%] left-[42%] w-[46vw] aspect-square rounded-full border border-[rgba(237,234,227,0.04)]" />
        <span className="absolute -bottom-[40%] right-[4%] w-[26vw] aspect-square rounded-full border border-[rgba(255,45,0,0.07)]" />
      </div>

      <motion.div style={{ y: textY }} className="relative z-10 px-5 md:px-10 max-w-5xl">
        <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#FF2D00] mb-8 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF2D00]" />
          END OF TRANSMISSION · 09 OF 09
        </div>

        <KineticWords
          text="Buyer funds stay protected."
          className="font-display font-normal text-[clamp(48px,12vw,180px)] text-[#EDEAE3] leading-[0.90] tracking-[-0.035em]"
        />
        <KineticWords
          text="Until the order is received."
          className="font-display font-normal text-[clamp(48px,12vw,180px)] text-[#EDEAE3]/80 leading-[0.90] tracking-[-0.035em] mt-2"
          delay={0.4}
        />

        <p className="font-serif text-[clamp(17px,1.4vw,21px)] text-[#C6C2B8] mt-8 max-w-xl italic">
          A protected checkout layer for social commerce — silent, serious, precise.
        </p>

        {/* CTAs */}
        <div className="mt-12 flex flex-col sm:flex-row sm:items-center gap-4">
          <CTAButton label="Open Protected Checkout" targetId="checkout" />
          <WalletCTAButton label="Preview Wallet Connect" />

          <button
            data-cursor="OPEN"
            onClick={() => document.getElementById("hero")?.scrollIntoView({ behavior: "smooth" })}
            className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8] hover:text-[#EDEAE3] transition-colors duration-300 underline-offset-4 hover:underline self-center px-4"
          >
            ↑ Back to top
          </button>

          {/* Transmission seal — closing stamp (lg+) */}
          <div aria-hidden className="hidden lg:flex flex-col items-end gap-1.5 ml-auto pr-2">
            <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#FF2D00] border border-[#FF2D00]/30 px-2.5 py-1.5">
              ▣ TRANSMISSION COMPLETE
            </span>
            <span className="font-mono-jb text-[8px] uppercase tracking-[0.3em] text-[#C6C2B8]/40">
              09 / 09 · PROTOTYPE
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-0 border-t border-[rgba(237,234,227,0.08)] pt-10">
          <div className="md:pr-10">
            <div className="font-mono-jb text-[8px] uppercase tracking-[0.3em] text-[#C6C2B8]/35 mb-4">
              F-01
            </div>
            <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8] mb-3">
              PROTOCOL
            </div>
            <div className="font-display font-medium text-[15px] text-[#EDEAE3] mb-1">
              Trustip
            </div>
            <div className="font-body text-[12px] text-[#C6C2B8]">
              Protected checkout layer for social commerce. Stellar-native USDC escrow via Soroban.
            </div>
          </div>
          <div className="md:border-l md:border-[rgba(237,234,227,0.06)] md:px-10">
            <div className="font-mono-jb text-[8px] uppercase tracking-[0.3em] text-[#C6C2B8]/35 mb-4">
              F-02
            </div>
            <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8] mb-3">
              CHANNELS
            </div>
            <ul className="space-y-1.5">
              {["Instagram", "TikTok", "WhatsApp", "Link-in-bio"].map((c) => (
                <li key={c} className="font-body text-[12px] text-[#C6C2B8] hover:text-[#EDEAE3] transition-colors">
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="md:border-l md:border-[rgba(237,234,227,0.06)] md:pl-10">
            <div className="font-mono-jb text-[8px] uppercase tracking-[0.3em] text-[#C6C2B8]/35 mb-4">
              F-03
            </div>
            <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8] mb-3">
              STACK
            </div>
            <ul className="space-y-1.5">
              {["Stellar Network", "USDC", "Soroban Smart Contracts", "Freighter · xBull"].map((s) => (
                <li key={s} className="font-body text-[12px] text-[#C6C2B8]">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Bottom marquee — doubled band, opposing directions */}
      <div className="relative z-10 mt-20 border-t border-[rgba(237,234,227,0.08)]">
        <div className="py-4">
          <Marquee
            items={[
              "PROTECTED CHECKOUT",
              "USDC ON STELLAR",
              "SOROBAN ESCROW",
              "SOCIAL COMMERCE",
              "TRUST PROFILE",
            ]}
          />
        </div>
        <div className="py-3 border-t border-[rgba(237,234,227,0.05)] opacity-50">
          <Marquee items={[...CHANNEL_MARQUEE_ITEMS]} reverse />
        </div>
      </div>
    </section>
  )
}
