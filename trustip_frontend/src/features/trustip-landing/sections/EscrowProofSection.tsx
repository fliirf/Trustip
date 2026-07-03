"use client"

import { useRef, useState } from "react"
import dynamic from "next/dynamic"
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion"
import { useCan3D } from "../three/useCan3D"
import { ProofRail } from "../motion/ProofRail"
import { ScanSweep } from "../motion/ScanSweep"
import { KineticWords } from "../motion/KineticWords"
import { SectionShell } from "../components/SectionShell"
import { PlateFrame } from "../components/PlateFrame"
import { MOCK_PROOF_ITEMS, ESCROW_STATES, DEMO_DISCLAIMER } from "../data/landing-content"
import { EASE, fadeUp } from "../motion/motion-presets"

const RESOLVE_THRESHOLD = 0.55

const EscrowOrbit3D = dynamic(() => import("../three/EscrowOrbit3D"), {
  ssr: false,
})

export function EscrowProofSection() {
  const can3D = useCan3D()
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })
  const [resolved, setResolved] = useState(false)

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setResolved(v > RESOLVE_THRESHOLD)
  })

  const dotAngle = useTransform(scrollYProgress, [0, 1], [0, 360])
  const dotRad = useTransform(dotAngle, (a) => (a * Math.PI) / 180)
  const dotX = useTransform(dotRad, (r) => 50 + 38 * Math.cos(r))
  const dotY = useTransform(dotRad, (r) => 50 + 38 * Math.sin(r))

  return (
    <SectionShell id="escrow" drift="left" ghostWord="PROOF" sectionRef={ref}>
      <div className="px-5 md:px-10 mb-10 md:mb-16 max-w-3xl">
        <motion.div
          className="flex items-center gap-3 mb-10"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8]">
            [04]
          </span>
          <span className="h-px w-8 bg-[rgba(237,234,227,0.08)]" />
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8]">
How funds stay protected
          </span>
        </motion.div>

        <KineticWords
          as="p"
          text="Payment travels a closed orbit."
          className="font-display font-normal text-[clamp(36px,7vw,96px)] text-[#EDEAE3] leading-[0.92] tracking-[-0.03em]"
          />
        <motion.p
          className="mt-6 font-body text-[clamp(17px,1.4vw,21px)] text-[#C6C2B8] max-w-xl leading-[1.55]"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          Once the payment is confirmed, the funds are locked and held safely until
          the order arrives. The orbit closes. Everything shown here is a demo.
        </motion.p>
      </div>

      {/* Two-column: orbit diagram + proof rail */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 px-5 md:px-10">
        {/* Left: orbit SVG — pins while the proof rail scrolls past */}
        <div className="lg:col-span-6 lg:sticky lg:top-[8vh] lg:self-start">
          <PlateFrame className="aspect-square bg-[#0A0A0A] overflow-hidden">
            {/* 3D escrow orbit — metallic coin + orbiting payment dot (desktop, lazy).
                The SVG below stays as the fallback and as the cardinal-label layer. */}
            {can3D && (
              <div className="absolute inset-0" aria-hidden>
                <EscrowOrbit3D progress={scrollYProgress} />
              </div>
            )}
            <svg viewBox="0 0 100 100" className={`absolute inset-0 w-full h-full ${can3D ? "opacity-40" : ""}`}>
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(237,234,227,0.1)" strokeWidth="0.3" />
              <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(237,234,227,0.15)" strokeWidth="0.3" />
              <circle cx="50" cy="50" r="15" fill="none" stroke="#FF2D00" strokeWidth="0.3" strokeDasharray="2 2" />
              <circle cx="50" cy="50" r="4" fill="#FF2D00" opacity="0.7" className="glow-blood" />
              <circle cx="50" cy="50" r="7" fill="none" stroke="#FF2D00" strokeWidth="0.3" opacity="0.4" />

              {/* Travelling dot */}
              <motion.circle
                r="1.5"
                fill="#FF2D00"
                style={{ cx: dotX, cy: dotY }}
              />

              {/* Cardinal labels */}
              <text x="50" y="6" textAnchor="middle" fill="#C6C2B8" fontFamily="JetBrains Mono" fontSize="2.5" letterSpacing="0.3em">N</text>
              <text x="50" y="98" textAnchor="middle" fill="#C6C2B8" fontFamily="JetBrains Mono" fontSize="2.5" letterSpacing="0.3em">S</text>
              <text x="6" y="52" textAnchor="middle" fill="#C6C2B8" fontFamily="JetBrains Mono" fontSize="2.5" letterSpacing="0.3em">W</text>
              <text x="94" y="52" textAnchor="middle" fill="#C6C2B8" fontFamily="JetBrains Mono" fontSize="2.5" letterSpacing="0.3em">E</text>
            </svg>

            {/* Scanline texture — the chamber reads as a machine surface */}
            <div aria-hidden className="absolute inset-0 scanlines pointer-events-none opacity-50" />

            {/* Scan sweep — freezes once the chamber resolves */}
            <ScanSweep className="absolute inset-0" active={!resolved} />

            {/* Overlay label */}
            <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#C6C2B8]">
                  ESCROW ORBIT · DEMO
                </span>
                <span className="font-mono-jb text-[8px] uppercase tracking-[0.18em] text-[#C6C2B8]/45">
                  CONTRACT · CBX7QK…J4P2RA (MOCK)
                </span>
              </div>
              <motion.span
                className="font-mono-jb text-[9px] uppercase tracking-[0.22em]"
                animate={{ color: resolved ? "#FF2D00" : "#C6C2B8" }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                {resolved ? "● SIMULATED" : "○ SCANNING…"}
              </motion.span>
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
              <div className="flex items-end gap-3">
                {/* Lock-close confirmation — arms only once resolved */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="mb-0.5">
                  <motion.path
                    d="M8 10 V7 a4 4 0 0 1 8 0 V10"
                    stroke={resolved ? "#FF2D00" : "#C6C2B8"}
                    strokeWidth="1.5"
                    animate={{ y: resolved ? 0 : -2, opacity: resolved ? 1 : 0.4 }}
                    transition={{ duration: 0.4, ease: EASE }}
                  />
                  <rect
                    x="5"
                    y="10"
                    width="14"
                    height="10"
                    stroke={resolved ? "#FF2D00" : "#C6C2B8"}
                    strokeWidth="1.5"
                  />
                  <motion.circle
                    cx="12"
                    cy="15"
                    r="1.4"
                    fill={resolved ? "#FF2D00" : "#C6C2B8"}
                    animate={{ opacity: resolved ? 1 : 0.5 }}
                  />
                </svg>
                <div>
                  <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#C6C2B8] mb-1">
                    STATE
                  </div>
                  <div className="font-display font-medium text-[clamp(17px,1.4vw,21px)] text-[#EDEAE3]">
                    {resolved ? "ESCROW LOCKED (DEMO)" : "VERIFYING (DEMO)"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#C6C2B8] mb-1">
                  VERIFICATION
                </div>
                <div className="font-mono-jb text-[15px] text-[#FF2D00]">
                  {resolved ? "● VERIFIED (SIM)" : "◌ RESOLVING…"}
                </div>
              </div>
            </div>
          </PlateFrame>

          {/* Scan-axis ruler under the chamber */}
          <div aria-hidden className="flex items-center gap-3 mt-3 px-1">
            <span
              className="flex-1 h-[5px]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgba(237,234,227,0.14) 0 1px, transparent 1px 24px)",
                borderBottom: "1px solid rgba(237,234,227,0.08)",
              }}
            />
            <span className="font-mono-jb text-[8px] uppercase tracking-[0.3em] text-[#C6C2B8]/40 shrink-0">
              SCAN AXIS · 0—360°
            </span>
          </div>
        </div>

        {/* Right: proof rail */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <ProofRail items={MOCK_PROOF_ITEMS} />

          {/* Escrow state timeline */}
          <div className="border border-[rgba(237,234,227,0.08)] p-6">
            <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8] mb-4">
              ESCROW LIFECYCLE (DEMO)
            </div>
            {ESCROW_STATES.map((s, i) => (
              <div key={s.id} className="flex items-center gap-4 py-2">
                <div className="relative flex flex-col items-center">
                  <motion.span
                    className="w-2 h-2 rounded-full"
                    animate={{
                      backgroundColor: i < 2 || resolved ? "#FF2D00" : "rgba(237,234,227,0.15)",
                    }}
                    transition={{ duration: 0.4, ease: EASE }}
                  />
                  {i < ESCROW_STATES.length - 1 && (
                    <span className="w-px h-6 bg-[rgba(237,234,227,0.06)] mt-1" />
                  )}
                </div>
                <div>
                  <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#FF2D00]">
                    {s.en}
                  </div>
                  <div className="font-display font-normal text-[17px] text-[#EDEAE3]">
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="relative z-10 px-5 md:px-10 mt-12 max-w-2xl">
        <div className="border-l-2 border-[#FF2D00] pl-5">
          <p className="font-body text-[15px] text-[#EDEAE3]/60">
            {DEMO_DISCLAIMER}
          </p>
          <p className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#C6C2B8] mt-3">
            [ NO REAL BLOCKCHAIN ACTIVITY — PROTOTYPE ONLY ]
          </p>
        </div>
      </div>
    </SectionShell>
  )
}
