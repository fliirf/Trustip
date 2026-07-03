"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { SectionShell } from "../components/SectionShell"
import { PlateFrame } from "../components/PlateFrame"
import { PAYOUT_ROUTES } from "../data/landing-content"
import { EASE, fadeUp } from "../motion/motion-presets"

export function PayoutRouteSection() {
  const [active, setActive] = useState("usdc")
  const [preview, setPreview] = useState<string | null>(null)
  const reduce = useReducedMotion()
  const displayed = preview ?? active

  return (
    <SectionShell id="payout" ghostWord="DANA">
      <div className="px-5 md:px-10 mb-10 md:mb-14 max-w-3xl">
        <motion.div
          className="flex items-center gap-3 mb-10"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#B9B5AB]">
            [08]
          </span>
          <span className="h-px w-8 bg-[rgba(237,234,227,0.08)]" />
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#B9B5AB]">
            Seller Payout Routes — Cara Terima Dana
          </span>
        </motion.div>

        <motion.p
          className="font-display font-normal text-[clamp(36px,7vw,96px)] text-[#EDEAE3] leading-[0.92] tracking-[-0.03em]"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          Three quiet routes to cash.
        </motion.p>
        <motion.p
          className="mt-6 font-body text-[clamp(17px,1.4vw,21px)] text-[#B9B5AB] max-w-xl leading-[1.55]"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          Seller receives payout after the order is confirmed or after review resolution.
          No automatic conversion overpromise. No direct bank transfer.
        </motion.p>
      </div>

      {/* Route-split diagram */}
      <div className="relative z-10 px-5 md:px-10 mb-12">
        <PlateFrame status="RELEASE · CONTROLLED (DEMO)" className="bg-[#0A0A0A] p-6 md:p-8">
          <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#B9B5AB] mb-6 pr-24 md:pr-44">
            PAYOUT ROUTE SPLIT — ESCROW → RELEASE → ROUTE
          </div>
          <div className="relative h-56 md:h-72 mb-4">
            <svg viewBox="0 0 800 240" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
              {/* Map grid — meridian hairlines */}
              {[200, 400, 600].map((mx) => (
                <line key={`mx-${mx}`} x1={mx} y1="16" x2={mx} y2="224" stroke="rgba(237,234,227,0.045)" strokeWidth="1" strokeDasharray="2 6" />
              ))}
              {[60, 180].map((my) => (
                <line key={`my-${my}`} x1="20" y1={my} x2="780" y2={my} stroke="rgba(237,234,227,0.035)" strokeWidth="1" strokeDasharray="2 6" />
              ))}
              <text x="24" y="26" fill="rgba(185,181,171,0.35)" fontFamily="JetBrains Mono" fontSize="7" letterSpacing="0.2em">GRID · P-08</text>
              <text x="776" y="234" textAnchor="end" fill="rgba(185,181,171,0.35)" fontFamily="JetBrains Mono" fontSize="7" letterSpacing="0.2em">TOPOLOGY (DEMO)</text>

              {/* Trunk: escrow → release */}
              <line x1="80" y1="120" x2="300" y2="120" stroke="rgba(237,234,227,0.08)" strokeWidth="1.5" />
              <motion.line
                x1="80"
                y1="120"
                x2="300"
                y2="120"
                stroke="#FF2D00"
                strokeWidth="1.5"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: EASE, delay: 0.2 }}
              />

              {/* Split branches: release → each destination */}
              {PAYOUT_ROUTES.map((route, i) => {
                const destY = [50, 120, 190][i]
                const isActive = displayed === route.id
                return (
                  <g key={route.id}>
                    <line x1="300" y1="120" x2="700" y2={destY} stroke="rgba(237,234,227,0.08)" strokeWidth="1.5" />
                    <motion.line
                      x1="300"
                      y1="120"
                      x2="700"
                      y2={destY}
                      stroke={isActive ? "#FF2D00" : "rgba(237,234,227,0.14)"}
                      strokeWidth="1.5"
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: EASE, delay: 0.5 + i * 0.15 }}
                    />
                    {/* Branch ETA label at midpoint */}
                    <text
                      x="500"
                      y={(120 + destY) / 2 - 8}
                      textAnchor="middle"
                      fill={isActive ? "rgba(255,45,0,0.85)" : "rgba(185,181,171,0.4)"}
                      fontFamily="JetBrains Mono"
                      fontSize="7"
                      letterSpacing="0.18em"
                    >
                      {route.eta}
                    </text>
                    {/* Destination plate */}
                    <rect
                      x="700"
                      y={destY - 16}
                      width="92"
                      height="32"
                      fill="#050505"
                      stroke={isActive ? "#FF2D00" : "rgba(237,234,227,0.2)"}
                      strokeWidth="1"
                    />
                    <circle
                      cx="708"
                      cy={destY}
                      r="2.5"
                      fill={isActive ? "#FF2D00" : "rgba(185,181,171,0.4)"}
                    />
                    <text
                      x="750"
                      y={destY + 4}
                      textAnchor="middle"
                      fill={isActive ? "#FF2D00" : "#B9B5AB"}
                      fontFamily="JetBrains Mono"
                      fontSize="8"
                      letterSpacing="0.14em"
                    >
                      {route.id.toUpperCase()}
                    </text>
                    {/* Travelling dot — bright on the displayed route, faint idle flow on the rest */}
                    <motion.circle
                      r={isActive ? "3.5" : "2"}
                      fill="#FF2D00"
                      opacity={isActive ? 1 : 0.25}
                      animate={{ cx: [300, 700], cy: [120, destY] }}
                      transition={{
                        duration: isActive ? 2.4 : 3.6,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: isActive ? 0 : i * 0.5,
                      }}
                    />
                  </g>
                )
              })}

              {/* Escrow source */}
              <rect x="8" y="104" width="72" height="32" fill="none" stroke="rgba(237,234,227,0.3)" strokeWidth="1" />
              <text x="44" y="124" textAnchor="middle" fill="#EDEAE3" fontFamily="JetBrains Mono" fontSize="8" letterSpacing="0.14em">ESCROW</text>

              {/* Release node — the controlled gate */}
              <circle cx="300" cy="120" r="6" fill="#FF2D00" />
              <motion.circle
                cx="300"
                cy="120"
                r="12"
                fill="none"
                stroke="#FF2D00"
                strokeWidth="0.6"
                opacity="0.4"
                animate={reduce ? undefined : { r: [12, 18, 12], opacity: [0.4, 0.08, 0.4] }}
                transition={reduce ? undefined : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              />
              <text x="300" y="98" textAnchor="middle" fill="#FF2D00" fontFamily="JetBrains Mono" fontSize="7" letterSpacing="0.14em">RELEASE</text>
            </svg>
          </div>

          {/* Map legend strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(237,234,227,0.06)] pt-3">
            <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#B9B5AB]/50">
              SPLIT · PAYOUT — ROUTES 3 · USDC / XLM / MONEYGRAM
            </span>
            <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#B9B5AB]/50">
              RELEASE AFTER CONFIRMATION (DEMO) · NO BANK TRANSFER
            </span>
          </div>
        </PlateFrame>
      </div>

      {/* Route options */}
      <div className="relative z-10 px-5 md:px-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        {PAYOUT_ROUTES.map((route, i) => (
          <motion.button
            key={route.id}
            data-cursor="SELECT"
            onClick={() => setActive(route.id)}
            onHoverStart={() => setPreview(route.id)}
            onHoverEnd={() => setPreview(null)}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.7, ease: EASE }}
            className={`relative text-left border p-6 transition-all duration-500 ${
              displayed === route.id
                ? "border-[#FF2D00] bg-[#0A0A0A]"
                : "border-[rgba(237,234,227,0.08)] hover:border-[#EDEAE3]/30 bg-[#0A0A0A]"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#B9B5AB]">
                ROUTE · 00{i + 1}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  displayed === route.id ? "bg-[#FF2D00]" : "bg-[rgba(237,234,227,0.12)]"
                }`}
              />
            </div>
            <div className="flex items-center gap-3 mb-3">
              <span
                className={`text-[26px] leading-none transition-colors duration-500 ${
                  displayed === route.id ? "text-[#FF2D00]" : "text-[#EDEAE3]/30"
                }`}
                aria-hidden
              >
                {route.icon}
              </span>
              <div className="font-display font-medium text-[clamp(20px,3.4vw,46px)] text-[#EDEAE3] leading-[1.04]">
                {route.label}
              </div>
            </div>
            <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#FF2D00] mb-4">
              ETA · {route.eta}
            </div>
            <p className="font-body text-[15px] text-[#B9B5AB]">{route.desc}</p>
          </motion.button>
        ))}
      </div>

      {/* Footer note */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative z-10 px-5 md:px-10 mt-12 max-w-2xl"
      >
        <div className="border-l-2 border-[#FF2D00] pl-5">
          <p className="font-body text-[clamp(17px,1.4vw,21px)] text-[#EDEAE3]/80 leading-[1.55]">
            Seller receives payout{" "}
            <span className="text-[#EDEAE3]">after the order is confirmed</span> or after
            review resolution.
          </p>
          <p className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#B9B5AB] mt-3">
            [ NOTE — USDC / XLM / MONEYGRAM ONLY · NO BANK TRANSFER · NO BINANCE PAY ]
          </p>
        </div>
      </motion.div>
    </SectionShell>
  )
}
