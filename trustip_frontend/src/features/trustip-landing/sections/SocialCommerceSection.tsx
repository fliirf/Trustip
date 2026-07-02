"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { SectionShell } from "../components/SectionShell"
import { EASE, fadeUp } from "../motion/motion-presets"

const PLATFORMS = [
  { id: "instagram", name: "Instagram", desc: "Jastip · Pre-order · Limited drops", accent: "#7B61FF" },
  { id: "tiktok", name: "TikTok", desc: "Group buys · Viral products · Live sales", accent: "#4F8CFF" },
  { id: "whatsapp", name: "WhatsApp", desc: "Direct chat · Personal deals · Second-hand", accent: "#16C784" },
]

export function SocialCommerceSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  // Platform surfaces start spread apart and pull inward toward the escrow
  // node as the section scrolls through view — a convergence, not a parallax.
  const pull = useTransform(scrollYProgress, [0.1, 0.6], [1, 0])
  const xLeft = useTransform(pull, (v) => -28 * v)
  const xRight = useTransform(pull, (v) => 28 * v)
  const lineScale = useTransform(scrollYProgress, [0.25, 0.55], [0, 1])

  return (
    <SectionShell id="commerce" ghostWord="SOCIAL">
      <div className="px-5 md:px-10 mb-16 md:mb-28 max-w-3xl">
        <motion.div
          className="flex items-center gap-3 mb-10"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            [06]
          </span>
          <span className="h-px w-8 bg-[rgba(255,255,255,0.08)]" />
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            Social Commerce — Where Trustip Lives
          </span>
        </motion.div>

        <motion.p
          className="font-display font-normal text-[clamp(36px,7vw,96px)] text-[#F7F8FA] leading-[0.92] tracking-[-0.03em]"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          Every social checkout link routes through the same escrow layer.
        </motion.p>
      </div>

      {/* Convergence composition: platforms → escrow → seller */}
      <div ref={ref} className="relative z-10 px-5 md:px-10">
        <div className="relative border border-[rgba(255,255,255,0.08)] bg-[#0D1018] px-5 md:px-10 py-14 md:py-20">
          {/* Platform surfaces */}
          <div className="relative z-10 flex flex-col sm:flex-row items-stretch justify-center gap-3 md:gap-4 mb-10">
            {PLATFORMS.map((p, i) => (
              <motion.div
                key={p.id}
                style={{ x: i === 0 ? xLeft : i === 2 ? xRight : undefined }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.7, ease: EASE }}
                className="flex-1 border border-[rgba(255,255,255,0.08)] bg-[#020204] p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: p.accent }}
                  />
                  <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB]">
                    {p.name}
                  </span>
                </div>
                <p className="font-body text-[13px] text-[#A6ADBB]/80 leading-[1.5]">
                  {p.desc}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Converging connector */}
          <div className="relative z-10 flex flex-col items-center mb-10">
            <motion.div
              style={{ scaleY: lineScale }}
              className="w-px h-10 bg-gradient-to-b from-[rgba(255,255,255,0.15)] to-[#16C784] origin-top"
            />
            <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB]/60 mt-2">
              routes through
            </span>
          </div>

          {/* Trustip escrow node */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE }}
            className="relative z-10 flex flex-col items-center"
          >
            <div className="relative w-16 h-16 md:w-20 md:h-20 grid place-items-center">
              <motion.span
                className="absolute inset-0 rounded-full border border-[#16C784]/40"
                animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.1, 0.5] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              />
              <span className="w-3 h-3 rounded-full bg-[#16C784]" />
            </div>
            <div className="mt-4 font-display font-medium text-[clamp(20px,3vw,32px)] text-[#F7F8FA]">
              Trustip Escrow Layer
            </div>
            <p className="mt-2 max-w-sm text-center font-body text-[14px] text-[#A6ADBB] leading-[1.6]">
              Instagram, TikTok, or WhatsApp — the checkout link always locks into the
              same Soroban escrow contract (DEMO).
            </p>
          </motion.div>

          {/* Seller endpoint */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6, ease: EASE }}
            className="relative z-10 mt-10 pt-8 border-t border-dashed border-[rgba(255,255,255,0.1)] flex flex-col items-center"
          >
            <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-2">
              SELLER
            </span>
            <p className="font-body text-[14px] text-[#A6ADBB]/80 text-center">
              Receives protected payout after delivery is confirmed.
            </p>
          </motion.div>
        </div>
      </div>
    </SectionShell>
  )
}
