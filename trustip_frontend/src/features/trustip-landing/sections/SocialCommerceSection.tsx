"use client"

import { useRef } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { KineticWords } from "../motion/KineticWords"
import { SectionShell } from "../components/SectionShell"
import { EASE, fadeUp } from "../motion/motion-presets"

const PLATFORMS = [
  { id: "instagram", name: "Instagram", desc: "Jastip · Pre-order · Limited drops", accent: "#EDEAE3" },
  { id: "tiktok", name: "TikTok", desc: "Group buys · Viral products · Live sales", accent: "#EDEAE3" },
  { id: "whatsapp", name: "WhatsApp", desc: "Direct chat · Personal deals · Second-hand", accent: "#FF2D00" },
]

/** Messy social-commerce inputs — chips overlapping the plate boundary. */
const FRAGMENTS = [
  { label: "IG · DM", dot: "#EDEAE3", pos: "left-[5%] -top-3", rot: -2 },
  { label: "LIVE SALE", dot: "#EDEAE3", pos: "left-[24%] -top-3.5", rot: 1.5 },
  { label: "GROUP BUY", dot: "#EDEAE3", pos: "left-[45%] -top-3", rot: -1 },
  { label: "WA · CHAT", dot: "#FF2D00", pos: "left-[64%] -top-3.5", rot: 2 },
  { label: "LINK-IN-BIO", dot: "#EDEAE3", pos: "left-[82%] -top-3", rot: -1.5 },
  { label: "trustip.link/…0042", dot: "#FF2D00", pos: "-right-3 top-[32%]", rot: 2, accent: true },
]

export function SocialCommerceSection() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  // Platform surfaces start spread apart and pull inward toward the escrow
  // node as the section scrolls through view — a convergence, not a parallax.
  const pull = useTransform(scrollYProgress, [0.1, 0.6], [1, 0])
  const xLeft = useTransform(pull, (v) => -28 * v)
  const xRight = useTransform(pull, (v) => 28 * v)
  const rotateLeft = useTransform(pull, (v) => -4 * v)
  const rotateRight = useTransform(pull, (v) => 4 * v)
  const lineScale = useTransform(scrollYProgress, [0.25, 0.55], [0, 1])
  const routeDensity = useTransform(scrollYProgress, [0.2, 0.55], [0, 1])

  return (
    <SectionShell id="commerce" drift="left" ghostWord="SOCIAL">
      <div className="px-5 md:px-10 mb-10 md:mb-16 max-w-3xl">
        <motion.div
          className="flex items-center gap-3 mb-10"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8]">
            [06]
          </span>
          <span className="h-px w-8 bg-[rgba(237,234,227,0.08)]" />
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8]">
            Social Commerce — Where Trustip Lives
          </span>
        </motion.div>

        <KineticWords
          as="p"
          text="Every social checkout link routes through the same escrow layer."
          className="font-display font-normal text-[clamp(36px,7vw,96px)] text-[#EDEAE3] leading-[0.92] tracking-[-0.03em]"
          />
      </div>

      {/* Convergence composition: platforms → escrow → seller */}
      <div ref={ref} className="relative z-10 px-5 md:px-10">
        <div className="relative border border-[rgba(237,234,227,0.08)] bg-[#0A0A0A] px-5 md:px-10 py-12 md:py-16">
          {/* Channel fragments — messy inputs crossing the plate boundary */}
          {FRAGMENTS.map((f, i) => (
            <motion.span
              key={f.label}
              aria-hidden
              initial={{ opacity: 0, y: 8, rotate: f.rot }}
              whileInView={{ opacity: 1, y: 0, rotate: f.rot }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.2 + i * 0.08 }}
              className={`hidden md:flex absolute ${f.pos} z-20 items-center gap-1.5 border border-[rgba(237,234,227,0.12)] bg-[#050505] px-2.5 py-1.5 font-mono-jb text-[8px] uppercase tracking-[0.18em] ${
                f.accent ? "text-[#FF2D00]" : "text-[#C6C2B8]"
              }`}
            >
              <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: f.dot }} />
              {f.label}
            </motion.span>
          ))}

          {/* Route density — each channel's path into the escrow layer */}
          <svg
            viewBox="0 0 300 170"
            preserveAspectRatio="none"
            aria-hidden
            className="absolute inset-0 w-full h-full pointer-events-none hidden sm:block"
          >
            {/* Faint feeder routes from the fragment zone above the plate */}
            {[
              { d: "M 18 0 C 26 42, 150 58, 150 108" },
              { d: "M 282 0 C 274 42, 150 58, 150 108" },
            ].map((p, i) => (
              <motion.path
                key={`feeder-${i}`}
                d={p.d}
                fill="none"
                stroke="rgba(255,45,0,0.12)"
                strokeWidth="0.5"
                style={{ pathLength: routeDensity }}
              />
            ))}
            {[
              { x: 50 },
              { x: 150 },
              { x: 250 },
            ].map((pt, i) => (
              <motion.path
                key={i}
                d={`M ${pt.x} 62 C ${pt.x} 100, 150 92, 150 108`}
                fill="none"
                stroke="rgba(255,45,0,0.3)"
                strokeWidth="0.7"
                strokeDasharray="3 5"
                style={{ opacity: routeDensity }}
                animate={reduce ? undefined : { strokeDashoffset: [0, -32] }}
                transition={
                  reduce ? undefined : { duration: 4, repeat: Infinity, ease: "linear" }
                }
              />
            ))}
          </svg>

          {/* Platform surfaces */}
          <div className="relative z-10 flex flex-col sm:flex-row items-stretch justify-center gap-3 md:gap-4 mb-10">
            {PLATFORMS.map((p, i) => (
              <motion.div
                key={p.id}
                style={{
                  x: i === 0 ? xLeft : i === 2 ? xRight : undefined,
                  rotate: i === 0 ? rotateLeft : i === 2 ? rotateRight : undefined,
                }}
                initial={{ opacity: 0, y: i === 1 ? 14 : 20 }}
                whileInView={{ opacity: 1, y: i === 1 ? -6 : 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.7, ease: EASE }}
                className={`card-hover flex-1 border border-[rgba(237,234,227,0.08)] bg-[#050505] p-5 ${
                  i === 1 ? "sm:shadow-[0_12px_28px_rgba(0,0,0,0.4)] sm:z-10" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: p.accent }}
                  />
                  <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#C6C2B8]">
                    {p.name}
                  </span>
                </div>
                <p className="font-body text-[13px] text-[#C6C2B8]/80 leading-[1.5]">
                  {p.desc}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Converging connector */}
          <div className="relative z-10 flex flex-col items-center mb-10">
            <motion.div
              style={{ scaleY: lineScale }}
              className="w-px h-10 bg-gradient-to-b from-[rgba(237,234,227,0.15)] to-[#FF2D00] origin-top"
            />
            <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#C6C2B8]/60 mt-2">
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
                className="absolute inset-0 rounded-full border border-[#FF2D00]/40"
                animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.1, 0.5] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              />
              <span className="w-3 h-3 rounded-full bg-[#FF2D00] shadow-blood" />
            </div>
            <div className="mt-4 font-display font-medium text-[clamp(20px,3vw,32px)] text-[#EDEAE3]">
              Trustip Escrow Layer
            </div>
            <p className="mt-2 max-w-sm text-center font-body text-[14px] text-[#C6C2B8] leading-[1.6]">
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
            className="relative z-10 mt-10 pt-8 border-t border-dashed border-[rgba(237,234,227,0.1)] flex flex-col items-center"
          >
            <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#C6C2B8] mb-2">
              SELLER
            </span>
            <p className="font-body text-[14px] text-[#C6C2B8]/80 text-center">
              Receives protected payout after delivery is confirmed.
            </p>
          </motion.div>

          {/* Convergence meta strip */}
          <div className="relative z-10 mt-10 -mx-5 md:-mx-10 -mb-14 md:-mb-20 border-t border-[rgba(237,234,227,0.06)] px-5 md:px-10 py-3 flex items-center justify-between">
            <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#C6C2B8]/50">
              INPUTS 6 · CHANNELS 3 · ROUTE 1 — PROTECTED LAYER (DEMO)
            </span>
            <span className="hidden sm:block font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#FF2D00]/60">
              CONVERGENCE STABLE
            </span>
          </div>
        </div>
      </div>
    </SectionShell>
  )
}
