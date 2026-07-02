"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { KineticWords } from "../motion/KineticWords"
import { WalletCTAButton } from "../components/WalletCTAButton"
import { CTAButton } from "../components/CTAButton"
import { Marquee } from "@/components/void/marquee"
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
      className="relative w-full overflow-hidden border-t border-[rgba(255,255,255,0.08)] py-24 md:py-36 lg:pl-32"
    >
      {/* Ghost word */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 select-none"
        aria-hidden
      >
        <span
          className="font-display font-light leading-none text-[rgba(247,248,250,0.03)]"
          style={{ fontSize: "clamp(200px, 28vw, 480px)" }}
        >
          TRUSTIP
        </span>
      </div>

      <motion.div style={{ y: textY }} className="relative z-10 px-5 md:px-10 max-w-5xl">
        <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#16C784] mb-8 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16C784]" />
          END OF TRANSMISSION · 09 OF 09
        </div>

        <KineticWords
          text="Buyer funds stay protected."
          className="font-display font-normal text-[clamp(48px,12vw,180px)] text-[#F7F8FA] leading-[0.90] tracking-[-0.035em]"
        />
        <KineticWords
          text="Until the order is received."
          className="font-display font-normal text-[clamp(48px,12vw,180px)] text-[#F7F8FA]/80 leading-[0.90] tracking-[-0.035em] mt-2"
          delay={0.4}
        />

        <p className="font-serif text-[clamp(17px,1.4vw,21px)] text-[#A6ADBB] mt-8 max-w-xl italic">
          A protected checkout layer for social commerce — silent, serious, precise.
        </p>

        {/* CTAs */}
        <div className="mt-12 flex flex-col sm:flex-row sm:items-center gap-4">
          <CTAButton label="Open Protected Checkout" targetId="checkout" />
          <WalletCTAButton label="Preview Wallet Connect" />

          <button
            data-cursor="OPEN"
            onClick={() => document.getElementById("hero")?.scrollIntoView({ behavior: "smooth" })}
            className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB] hover:text-[#F7F8FA] transition-colors duration-300 underline-offset-4 hover:underline self-center px-4"
          >
            ↑ Back to top
          </button>
        </div>

        {/* Footer */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-10 border-t border-[rgba(255,255,255,0.08)] pt-10">
          <div>
            <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-3">
              PROTOCOL
            </div>
            <div className="font-display font-medium text-[15px] text-[#F7F8FA] mb-1">
              Trustip
            </div>
            <div className="font-body text-[12px] text-[#A6ADBB]">
              Protected checkout layer for social commerce. Stellar-native USDC escrow via Soroban.
            </div>
          </div>
          <div>
            <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-3">
              CHANNELS
            </div>
            <ul className="space-y-1.5">
              {["Instagram", "TikTok", "WhatsApp", "Link-in-bio"].map((c) => (
                <li key={c} className="font-body text-[12px] text-[#A6ADBB] hover:text-[#F7F8FA] transition-colors">
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-3">
              STACK
            </div>
            <ul className="space-y-1.5">
              {["Stellar Network", "USDC", "Soroban Smart Contracts", "Freighter · xBull"].map((s) => (
                <li key={s} className="font-body text-[12px] text-[#A6ADBB]">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Bottom marquee */}
      <div className="relative z-10 mt-20 border-t border-[rgba(255,255,255,0.08)] py-4">
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
    </section>
  )
}
