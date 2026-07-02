"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { ProofRail } from "../motion/ProofRail"
import { SectionShell } from "../components/SectionShell"
import { PlateFrame } from "../components/PlateFrame"
import { MOCK_PROOF_ITEMS, ESCROW_STATES, DEMO_DISCLAIMER } from "../data/landing-content"
import { EASE, fadeUp } from "../motion/motion-presets"

export function EscrowProofSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  const dotAngle = useTransform(scrollYProgress, [0, 1], [0, 360])
  const dotRad = useTransform(dotAngle, (a) => (a * Math.PI) / 180)
  const dotX = useTransform(dotRad, (r) => 50 + 38 * Math.cos(r))
  const dotY = useTransform(dotRad, (r) => 50 + 38 * Math.sin(r))

  return (
    <SectionShell id="escrow" ghostWord="PROOF">
      <div className="px-5 md:px-10 mb-16 md:mb-28 max-w-3xl">
        <motion.div
          className="flex items-center gap-3 mb-10"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            [04]
          </span>
          <span className="h-px w-8 bg-[rgba(255,255,255,0.08)]" />
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            Escrow Proof — Soroban / Stellar (Demo Simulation)
          </span>
        </motion.div>

        <motion.p
          className="font-display font-normal text-[clamp(36px,7vw,96px)] text-[#F7F8FA] leading-[0.92] tracking-[-0.03em]"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          Payment travels a closed orbit.
        </motion.p>
        <motion.p
          className="mt-6 font-body text-[clamp(17px,1.4vw,21px)] text-[#A6ADBB] max-w-xl leading-[1.55]"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          After backend and on-chain confirmation, USDC locks into a Soroban escrow
          contract. The orbit closes. These values are demo simulations.
        </motion.p>
      </div>

      {/* Two-column: orbit diagram + proof rail */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 px-5 md:px-10">
        {/* Left: orbit SVG */}
        <div className="lg:col-span-6">
          <PlateFrame className="aspect-square bg-[#0D1018] overflow-hidden">
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.3" />
              <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.3" />
              <circle cx="50" cy="50" r="15" fill="none" stroke="#16C784" strokeWidth="0.3" strokeDasharray="2 2" />
              <circle cx="50" cy="50" r="4" fill="#16C784" opacity="0.7" />
              <circle cx="50" cy="50" r="7" fill="none" stroke="#16C784" strokeWidth="0.3" opacity="0.4" />

              {/* Travelling dot */}
              <motion.circle
                r="1.5"
                fill="#16C784"
                style={{ cx: dotX, cy: dotY }}
              />

              {/* Cardinal labels */}
              <text x="50" y="6" textAnchor="middle" fill="#A6ADBB" fontFamily="JetBrains Mono" fontSize="2.5" letterSpacing="0.3em">N</text>
              <text x="50" y="98" textAnchor="middle" fill="#A6ADBB" fontFamily="JetBrains Mono" fontSize="2.5" letterSpacing="0.3em">S</text>
              <text x="6" y="52" textAnchor="middle" fill="#A6ADBB" fontFamily="JetBrains Mono" fontSize="2.5" letterSpacing="0.3em">W</text>
              <text x="94" y="52" textAnchor="middle" fill="#A6ADBB" fontFamily="JetBrains Mono" fontSize="2.5" letterSpacing="0.3em">E</text>
            </svg>

            {/* Overlay label */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB]">
                ESCROW ORBIT · DEMO
              </span>
              <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#16C784]">
                ● SIMULATED
              </span>
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
              <div className="flex items-end gap-3">
                {/* Lock-close confirmation */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="mb-0.5">
                  <motion.path
                    d="M8 10 V7 a4 4 0 0 1 8 0 V10"
                    stroke="#16C784"
                    strokeWidth="1.5"
                    initial={{ y: -3, opacity: 0.3 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}
                  />
                  <rect x="5" y="10" width="14" height="10" stroke="#16C784" strokeWidth="1.5" />
                  <circle cx="12" cy="15" r="1.4" fill="#16C784" />
                </svg>
                <div>
                  <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-1">
                    STATE
                  </div>
                  <div className="font-display font-medium text-[clamp(17px,1.4vw,21px)] text-[#F7F8FA]">
                    ESCROW LOCKED (DEMO)
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-1">
                  VERIFICATION
                </div>
                <div className="font-mono-jb text-[15px] text-[#16C784]">
                  ● VERIFIED (SIM)
                </div>
              </div>
            </div>
          </PlateFrame>
        </div>

        {/* Right: proof rail */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <ProofRail items={MOCK_PROOF_ITEMS} />

          {/* Escrow state timeline */}
          <div className="border border-[rgba(255,255,255,0.08)] p-6">
            <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-4">
              ESCROW LIFECYCLE (DEMO)
            </div>
            {ESCROW_STATES.map((s, i) => (
              <div key={s.id} className="flex items-center gap-4 py-2">
                <div className="relative flex flex-col items-center">
                  <motion.span
                    className="w-2 h-2 rounded-full"
                    animate={{
                      backgroundColor: i <= 2 ? "#16C784" : "rgba(255,255,255,0.15)",
                    }}
                    transition={{ duration: 0.4, ease: EASE }}
                  />
                  {i < ESCROW_STATES.length - 1 && (
                    <span className="w-px h-6 bg-[rgba(255,255,255,0.06)] mt-1" />
                  )}
                </div>
                <div>
                  <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#16C784]">
                    {s.en}
                  </div>
                  <div className="font-display font-normal text-[17px] text-[#F7F8FA]">
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
        <div className="border-l-2 border-[#16C784] pl-5">
          <p className="font-body text-[15px] text-[#F7F8FA]/60">
            {DEMO_DISCLAIMER}
          </p>
          <p className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB] mt-3">
            [ NO REAL BLOCKCHAIN ACTIVITY — PROTOTYPE ONLY ]
          </p>
        </div>
      </div>
    </SectionShell>
  )
}
