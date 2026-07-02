"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { VelocityScrollBand } from "../motion/VelocityScrollBand"
import { SectionShell } from "../components/SectionShell"
import { SOCIAL_RISK_EXAMPLES, RISK_WORDS } from "../data/landing-content"
import { EASE, fadeUp } from "../motion/motion-presets"

export function ProblemSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.6, 0.85], [0, 1, 1, 0])

  return (
    <SectionShell id="problem" ghostWord="RISK">
      {/* Opener */}
      <div className="px-5 md:px-10 mb-16 md:mb-28 max-w-3xl">
        <motion.div
          className="flex items-center gap-3 mb-10"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            [02]
          </span>
          <span className="h-px w-8 bg-[rgba(255,255,255,0.08)]" />
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            The Problem — Social Commerce Has No Protection
          </span>
        </motion.div>

        <motion.p
          className="font-display font-normal text-[clamp(36px,7vw,96px)] text-[#F7F8FA] leading-[0.92] tracking-[-0.03em]"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          Every day, buyers lose money to ghost sellers, fake goods, and disappeared deposits.
        </motion.p>
      </div>

      {/* Velocity scroll band: risk cards */}
      <motion.div style={{ opacity }} className="relative z-10 mb-16">
        <VelocityScrollBand speed={0.6}>
          {SOCIAL_RISK_EXAMPLES.map((risk, i) => (
            <motion.div
              key={i}
              className="relative flex-shrink-0 w-[320px] md:w-[400px] border border-[rgba(255,255,255,0.08)] border-t-transparent bg-[#0D1018] p-6 overflow-hidden"
              initial={{ opacity: 0, y: 20, rotate: i % 2 === 0 ? -1 : 1 }}
              whileInView={{ opacity: 1, y: 0, rotate: i % 2 === 0 ? -1 : 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.7, ease: EASE }}
            >
              {/* Receipt perforation */}
              <div className="absolute top-0 left-0 right-0 border-t border-dashed border-[rgba(255,255,255,0.14)]" />

              {/* Chat/receipt header */}
              <div className="flex items-center justify-between mb-4 pt-1">
                <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB] flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#FF2D00] animate-pulse" />
                  {risk.platform} · CHAT LOG
                </span>
                <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB]">
                  {risk.amount}
                </span>
              </div>
              {risk.caseType && (
                <span className="inline-block font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#16C784] border border-[#16C784]/30 px-1.5 py-0.5 mb-2">
                  {risk.caseType}
                </span>
              )}
              <div className="font-display font-medium text-[17px] text-[#F7F8FA] mb-3">
                {risk.scenario}
              </div>
              <p className="font-body text-[15px] text-[#A6ADBB] leading-[1.6]">
                {risk.risk}
              </p>

              {/* Footer + stamp */}
              <div className="mt-5 pt-4 border-t border-dashed border-[rgba(255,255,255,0.08)] font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#A6ADBB]/50">
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
              className="font-mono-jb text-[11px] uppercase tracking-[0.22em] text-[rgba(255,255,255,0.15)] border border-[rgba(255,255,255,0.06)] px-4 py-2"
            >
              {word}
            </motion.span>
          ))}
        </div>
      </div>
    </SectionShell>
  )
}
