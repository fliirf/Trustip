"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { TrustGraphCanvas } from "../motion/TrustGraphCanvas"
import { SectionShell } from "../components/SectionShell"
import { MetaCluster } from "../components/MetaCluster"
import { TRUST_METRICS, TRUST_REVIEWS, EVIDENCE_PLATES } from "../data/landing-content"
import { EASE, fadeUp, cardStagger } from "../motion/motion-presets"

export function SellerTrustSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  // Draws the reputation ring to 96.4% (completed-order rate) as the section enters.
  const ringProgress = useTransform(scrollYProgress, [0.15, 0.55], [0, 0.964])

  return (
    <SectionShell id="trust" ghostWord="TRUST" sectionRef={ref}>
      {/* Opener-right metadata — control-room corner annotation (lg+) */}
      <div aria-hidden className="hidden lg:block absolute right-14 top-32 pointer-events-none">
        <MetaCluster
          align="right"
          rows={[
            { label: "PROFILE", value: "TRP-S-0117 (DEMO)" },
            { label: "ORDERS", value: "312 PROTECTED (DEMO)" },
            { label: "SIGNAL", value: "96.4% COMPLETED", accent: true },
          ]}
        />
      </div>

      <div className="px-5 md:px-10 mb-12 md:mb-20 max-w-3xl">
        <motion.div
          className="flex items-center gap-3 mb-10"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#B9B5AB]">
            [07]
          </span>
          <span className="h-px w-8 bg-[rgba(237,234,227,0.08)]" />
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#B9B5AB]">
            Seller Trust Profile — Reputation & Dispute Safety
          </span>
        </motion.div>

        <motion.p
          className="font-display font-normal text-[clamp(36px,7vw,96px)] text-[#EDEAE3] leading-[0.92] tracking-[-0.03em]"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          A living trust archive.
        </motion.p>
      </div>

      {/* Trust graph + metrics side by side */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 px-5 md:px-10 mb-8">
        {/* Graph */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative lg:col-span-5 border border-[rgba(237,234,227,0.08)] bg-[#0A0A0A] p-6"
        >
          <span aria-hidden className="absolute top-0 left-0 w-0 h-0 crosshair-tl" />
          <span aria-hidden className="absolute top-0 right-0 w-0 h-0 crosshair-tr" />
          <span aria-hidden className="absolute bottom-0 left-0 w-0 h-0 crosshair-bl" />
          <span aria-hidden className="absolute bottom-0 right-0 w-0 h-0 crosshair-br" />

          <div className="flex items-center justify-between mb-4">
            <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#B9B5AB]">
              TRUST CONSTELLATION (DEMO)
            </span>
            <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#FF2D00]/70">
              ● LIVE FIELD (SIM)
            </span>
          </div>

          {/* Reputation ring — scroll-drawn to completed-order rate */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[rgba(237,234,227,0.06)]">
            <div className="relative w-16 h-16 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(237,234,227,0.08)" strokeWidth="1.5" />
                <motion.circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="#FF2D00"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  style={{ pathLength: ringProgress }}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center font-mono-jb text-[11px] text-[#FF2D00]">
                96%
              </div>
            </div>
            <div>
              <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#B9B5AB] mb-1">
                REPUTATION SIGNAL (DEMO)
              </div>
              <div className="font-display font-normal text-[15px] text-[#EDEAE3] leading-tight">
                312 protected orders · 96.4% completed
              </div>
            </div>
          </div>

          <div className="aspect-square w-full">
            <TrustGraphCanvas progress={scrollYProgress} />
          </div>
          <div className="mt-2 pt-3 border-t border-[rgba(237,234,227,0.06)] font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#B9B5AB]/40">
            NODES ACTIVATE ON SCROLL · HOVER TO TRACE EDGES
          </div>
        </motion.div>

        {/* Metrics rail — unified rows, not isolated cards */}
        <div className="lg:col-span-7 border border-[rgba(237,234,227,0.08)] bg-[#0A0A0A]">
          {TRUST_METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.5, ease: EASE }}
              className="flex items-baseline justify-between px-5 md:px-7 py-5 border-b border-[rgba(237,234,227,0.06)] last:border-b-0"
            >
              <div>
                <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#B9B5AB]">
                  {m.label}
                </div>
                <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#B9B5AB]/50 mt-1">
                  {m.sub}
                </div>
              </div>
              <div className="font-display font-light text-[clamp(28px,4vw,56px)] text-[#EDEAE3] leading-none">
                {m.value}{m.suffix}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Evidence archive — abstract framed proof panels (control-room artifact) */}
      <div className="relative z-10 px-5 md:px-10 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {EVIDENCE_PLATES.map((ev, i) => (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.6, ease: EASE, delay: i * 0.1 }}
              className="relative border border-[rgba(237,234,227,0.08)] bg-[#0A0A0A] p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#FF2D00]">
                  {ev.tag}
                </span>
                <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#B9B5AB]/40 border border-[rgba(237,234,227,0.1)] px-1.5 py-0.5">
                  DEMO
                </span>
              </div>
              {/* Abstract evidence surface */}
              <div
                aria-hidden
                className="h-14 mb-3 border border-[rgba(237,234,227,0.06)]"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(135deg, rgba(237,234,227,0.05) 0 1px, transparent 1px 10px)",
                }}
              />
              <div className="font-display text-[15px] text-[#EDEAE3] leading-tight mb-1.5">
                {ev.title}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#B9B5AB]/50">
                  {ev.note}
                </span>
                <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#B9B5AB]/40">
                  INSPECT →
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="relative z-10 px-5 md:px-10">
        <div className="border border-[rgba(237,234,227,0.08)]">
          <div className="flex items-center justify-between border-b border-[rgba(237,234,227,0.06)] px-6 py-4">
            <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#B9B5AB]">
              RECENT BUYER REVIEWS (DEMO DATA)
            </span>
            <span className="hidden sm:block font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#B9B5AB]/40">
              ARCHIVE · 04 ENTRIES
            </span>
          </div>
          <div className="divide-y divide-[rgba(237,234,227,0.04)]">
            {TRUST_REVIEWS.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.5, ease: EASE }}
                className="px-6 py-4 flex items-start gap-4"
              >
                <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#B9B5AB]/40 pt-1.5 shrink-0">
                  R-0{i + 1}
                </span>
                <div className="flex gap-0.5 pt-1">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <span
                      key={j}
                      className={`w-1 h-1 rounded-full ${
                        j < r.mark ? "bg-[#FF2D00]" : "bg-[rgba(237,234,227,0.12)]"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#B9B5AB]">
                      {r.buyer}
                    </span>
                  </div>
                  <p className="font-body text-[14px] text-[#EDEAE3]/70">{r.note}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  )
}
