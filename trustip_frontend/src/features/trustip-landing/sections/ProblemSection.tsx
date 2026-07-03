"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { VelocityScrollBand } from "../motion/VelocityScrollBand"
import { SignalField } from "../motion/SignalField"
import { KineticWords } from "../motion/KineticWords"
import { SectionShell } from "../components/SectionShell"
import { SOCIAL_RISK_EXAMPLES, RISK_WORDS } from "../data/landing-content"
import { EASE, fadeUp } from "../motion/motion-presets"

export function ProblemSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.6, 0.85], [0, 1, 1, 0])

  return (
    <SectionShell id="problem" drift="right" ghostWord="RISK" sectionRef={ref}>
      {/* Ambient disruption layer — unstable field behind the editorial content */}
      <SignalField className="absolute inset-0" />

      {/* Framed risk fragments occupying the opener's empty right zone (lg+) */}
      <div aria-hidden className="hidden lg:block pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 14, rotate: 1.5 }}
          whileInView={{ opacity: 1, y: 0, rotate: 1.5 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.3 }}
          className="absolute top-28 right-14 w-60 border border-[#FF2D00]/25 bg-[#0A0A0A]/70 p-4"
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#FF2D00]/80">
              SIGNAL LOST
            </span>
            <span className="w-1 h-1 rounded-full bg-[#FF2D00]/80 animate-pulse" />
          </div>
          <p className="font-mono-jb text-[9px] uppercase tracking-[0.16em] leading-[1.7] text-[#C6C2B8]/70">
            SELLER OFFLINE · 14D
            <br />
            CHAT DELETED (MOCK)
            <br />
            LAST SEEN — UNKNOWN
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14, rotate: -2 }}
          whileInView={{ opacity: 1, y: 0, rotate: -2 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.5 }}
          className="absolute top-72 right-32 w-56 border border-[rgba(237,234,227,0.1)] bg-[#0A0A0A]/70 p-4"
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#C6C2B8]">
              ROUTE BROKEN
            </span>
            <span className="font-mono-jb text-[8px] text-[#FF2D00]/60">×</span>
          </div>
          <p className="font-mono-jb text-[9px] uppercase tracking-[0.16em] leading-[1.7] text-[#C6C2B8]/70">
            TRANSFER SENT (MOCK)
            <br />
            NO ESCROW · NO RECOURSE
          </p>
        </motion.div>
      </div>

      {/* Opener */}
      <div className="px-5 md:px-10 mb-10 md:mb-16 max-w-3xl">
        <motion.div
          className="flex items-center gap-3 mb-10"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8]">
            [02]
          </span>
          <span className="h-px w-8 bg-[rgba(237,234,227,0.08)]" />
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8]">
            The Problem — Social Commerce Has No Protection
          </span>
        </motion.div>

        <KineticWords
          as="p"
          text="Every day, buyers lose money to ghost sellers, fake goods, and disappeared deposits."
          className="font-display font-normal text-[clamp(36px,7vw,96px)] text-[#EDEAE3] leading-[0.92] tracking-[-0.03em]"
          />
      </div>

      {/* Velocity scroll band: risk cards */}
      <motion.div style={{ opacity }} className="relative z-10 mb-16">
        <VelocityScrollBand speed={0.6}>
          {SOCIAL_RISK_EXAMPLES.map((risk, i) => (
            <motion.div
              key={i}
              className="card-hover relative flex-shrink-0 w-[320px] md:w-[400px] border border-[rgba(237,234,227,0.08)] border-t-transparent bg-[#0A0A0A] p-6 overflow-hidden"
              initial={{ opacity: 0, y: 20, rotate: i % 2 === 0 ? -1 : 1 }}
              whileInView={{ opacity: 1, y: 0, rotate: i % 2 === 0 ? -1 : 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.7, ease: EASE }}
            >
              {/* Receipt perforation */}
              <div className="absolute top-0 left-0 right-0 border-t border-dashed border-[rgba(237,234,227,0.14)]" />

              {/* Chat/receipt header */}
              <div className="flex items-center justify-between mb-4 pt-1">
                <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#C6C2B8] flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#FF2D00] animate-pulse" />
                  {risk.platform} · CHAT LOG
                </span>
                <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#C6C2B8]">
                  {risk.amount}
                </span>
              </div>
              {risk.caseType && (
                <span className="inline-block font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#FF2D00] border border-[#FF2D00]/30 px-1.5 py-0.5 mb-2">
                  {risk.caseType}
                </span>
              )}
              <div className="font-display font-medium text-[17px] text-[#EDEAE3] mb-3">
                {risk.scenario}
              </div>
              <p className="font-body text-[15px] text-[#C6C2B8] leading-[1.6]">
                {risk.risk}
              </p>

              {/* Footer + stamp */}
              <div className="mt-5 pt-4 border-t border-dashed border-[rgba(237,234,227,0.08)] font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#C6C2B8]/50">
                NO ESCROW · NO REFUND · NO RECOURSE
              </div>
              <motion.span
                aria-hidden
                initial={{ opacity: 0, scale: 1.4, rotate: -18 }}
                whileInView={{ opacity: 1, scale: 1, rotate: -12 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.5, ease: EASE }}
                className="pointer-events-none absolute bottom-4 right-4 font-mono-jb text-[11px] uppercase tracking-[0.22em] text-[#FF2D00]/40 border border-[#FF2D00]/30 px-2 py-1"
              >
                UNPROTECTED
              </motion.span>
            </motion.div>
          ))}
        </VelocityScrollBand>
      </motion.div>

      {/* Risk word cloud */}
      <div className="relative z-10 px-5 md:px-10">
        <div className="flex flex-wrap gap-3">
          {RISK_WORDS.map((word, i) => (
            <motion.span
              key={word}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04, duration: 0.4, ease: EASE }}
              className="font-mono-jb text-[11px] uppercase tracking-[0.22em] text-[rgba(237,234,227,0.15)] border border-[rgba(237,234,227,0.06)] px-4 py-2"
            >
              {word}
            </motion.span>
          ))}
        </div>
      </div>
    </SectionShell>
  )
}
