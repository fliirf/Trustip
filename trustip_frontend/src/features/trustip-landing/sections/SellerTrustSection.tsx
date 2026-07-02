"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { TrustGraphCanvas } from "../motion/TrustGraphCanvas"
import { SectionShell } from "../components/SectionShell"
import { TRUST_METRICS, TRUST_REVIEWS } from "../data/landing-content"
import { EASE, fadeUp, cardStagger } from "../motion/motion-presets"

export function SellerTrustSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  // Draws the reputation ring to 96.4% (completed-order rate) as the section enters.
  const ringProgress = useTransform(scrollYProgress, [0.15, 0.55], [0, 0.964])

  return (
    <SectionShell id="trust" ghostWord="TRUST">
      <div className="px-5 md:px-10 mb-16 md:mb-28 max-w-3xl">
        <motion.div
          className="flex items-center gap-3 mb-10"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            [07]
          </span>
          <span className="h-px w-8 bg-[rgba(255,255,255,0.08)]" />
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            Seller Trust Profile — Reputation & Dispute Safety
          </span>
        </motion.div>

        <motion.p
          className="font-display font-normal text-[clamp(36px,7vw,96px)] text-[#F7F8FA] leading-[0.92] tracking-[-0.03em]"
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
          className="lg:col-span-5 border border-[rgba(255,255,255,0.08)] bg-[#0D1018] p-6"
        >
          <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-4">
            TRUST NETWORK GRAPH (DEMO)
          </div>

          {/* Reputation ring — scroll-drawn to completed-order rate */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[rgba(255,255,255,0.06)]">
            <div className="relative w-16 h-16 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
                <motion.circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="#16C784"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  style={{ pathLength: ringProgress }}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center font-mono-jb text-[11px] text-[#16C784]">
                96%
              </div>
            </div>
            <div>
              <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-1">
                REPUTATION SIGNAL (DEMO)
              </div>
              <div className="font-display font-normal text-[15px] text-[#F7F8FA] leading-tight">
                312 protected orders · 96.4% completed
              </div>
            </div>
          </div>

          <div className="aspect-square max-w-[300px] mx-auto">
            <TrustGraphCanvas />
          </div>
        </motion.div>

        {/* Metrics rail — unified rows, not isolated cards */}
        <div className="lg:col-span-7 border border-[rgba(255,255,255,0.08)] bg-[#0D1018]">
          {TRUST_METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.5, ease: EASE }}
              className="flex items-baseline justify-between px-5 md:px-7 py-5 border-b border-[rgba(255,255,255,0.06)] last:border-b-0"
            >
              <div>
                <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB]">
                  {m.label}
                </div>
                <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB]/50 mt-1">
                  {m.sub}
                </div>
              </div>
              <div className="font-display font-light text-[clamp(28px,4vw,56px)] text-[#F7F8FA] leading-none">
                {m.value}{m.suffix}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="relative z-10 px-5 md:px-10">
        <div className="border border-[rgba(255,255,255,0.08)]">
          <div className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
            <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
              RECENT BUYER REVIEWS (DEMO DATA)
            </span>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {TRUST_REVIEWS.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.5, ease: EASE }}
                className="px-6 py-4 flex items-start gap-4"
              >
                <div className="flex gap-0.5 pt-1">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <span
                      key={j}
                      className={`w-1 h-1 rounded-full ${
                        j < r.mark ? "bg-[#16C784]" : "bg-[rgba(255,255,255,0.12)]"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB]">
                      {r.buyer}
                    </span>
                  </div>
                  <p className="font-body text-[14px] text-[#F7F8FA]/70">{r.note}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  )
}
