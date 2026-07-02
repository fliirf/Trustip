"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { SectionShell } from "../components/SectionShell"
import { PlateFrame } from "../components/PlateFrame"
import { PAYOUT_ROUTES } from "../data/landing-content"
import { EASE, fadeUp } from "../motion/motion-presets"

export function PayoutRouteSection() {
  const [active, setActive] = useState("usdc")

  return (
    <SectionShell id="payout" ghostWord="PAYOUT">
      <div className="px-5 md:px-10 mb-16 md:mb-28 max-w-3xl">
        <motion.div
          className="flex items-center gap-3 mb-10"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            [08]
          </span>
          <span className="h-px w-8 bg-[rgba(255,255,255,0.08)]" />
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            Seller Payout Routes — Cara Terima Dana
          </span>
        </motion.div>

        <motion.p
          className="font-display font-normal text-[clamp(36px,7vw,96px)] text-[#F7F8FA] leading-[0.92] tracking-[-0.03em]"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          Three quiet routes to cash.
        </motion.p>
        <motion.p
          className="mt-6 font-body text-[clamp(17px,1.4vw,21px)] text-[#A6ADBB] max-w-xl leading-[1.55]"
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
        <PlateFrame label="SPLIT · PAYOUT" className="bg-[#0D1018] p-6 md:p-8">
          <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB] mb-6">
            PAYOUT ROUTE SPLIT — ESCROW → RELEASE → ROUTE
          </div>
          <div className="relative h-40 md:h-52 mb-8">
            <svg viewBox="0 0 800 240" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
              {/* Trunk: escrow → release */}
              <line x1="80" y1="120" x2="300" y2="120" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
              <motion.line
                x1="80"
                y1="120"
                x2="300"
                y2="120"
                stroke="#16C784"
                strokeWidth="1.5"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: EASE, delay: 0.2 }}
              />

              {/* Split branches: release → each destination */}
              {PAYOUT_ROUTES.map((route, i) => {
                const destY = [50, 120, 190][i]
                const isActive = active === route.id
                return (
                  <g key={route.id}>
                    <line x1="300" y1="120" x2="700" y2={destY} stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
                    <motion.line
                      x1="300"
                      y1="120"
                      x2="700"
                      y2={destY}
                      stroke={isActive ? "#16C784" : "rgba(255,255,255,0.14)"}
                      strokeWidth="1.5"
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: EASE, delay: 0.5 + i * 0.15 }}
                    />
                    {/* Destination node */}
                    <rect
                      x="700"
                      y={destY - 16}
                      width="92"
                      height="32"
                      fill="none"
                      stroke={isActive ? "#16C784" : "rgba(255,255,255,0.2)"}
                      strokeWidth="1"
                    />
                    <text
                      x="746"
                      y={destY + 4}
                      textAnchor="middle"
                      fill={isActive ? "#16C784" : "#A6ADBB"}
                      fontFamily="JetBrains Mono"
                      fontSize="8"
                      letterSpacing="0.14em"
                    >
                      {route.id.toUpperCase()}
                    </text>
                    {/* Travelling dot only on the active route */}
                    {isActive && (
                      <motion.circle
                        r="3.5"
                        fill="#16C784"
                        animate={{ cx: [300, 700], cy: [120, destY] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                  </g>
                )
              })}

              {/* Escrow source */}
              <rect x="8" y="104" width="72" height="32" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <text x="44" y="124" textAnchor="middle" fill="#F7F8FA" fontFamily="JetBrains Mono" fontSize="8" letterSpacing="0.14em">ESCROW</text>

              {/* Release node */}
              <circle cx="300" cy="120" r="6" fill="#16C784" />
              <circle cx="300" cy="120" r="12" fill="none" stroke="#16C784" strokeWidth="0.6" opacity="0.4" />
              <text x="300" y="98" textAnchor="middle" fill="#16C784" fontFamily="JetBrains Mono" fontSize="7" letterSpacing="0.14em">RELEASE</text>
            </svg>
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
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.7, ease: EASE }}
            className={`relative text-left border p-6 transition-all duration-500 ${
              active === route.id
                ? "border-[#16C784] bg-[#0D1018]"
                : "border-[rgba(255,255,255,0.08)] hover:border-[#F7F8FA]/30 bg-[#0D1018]"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB]">
                ROUTE · 00{i + 1}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  active === route.id ? "bg-[#16C784]" : "bg-[rgba(255,255,255,0.12)]"
                }`}
              />
            </div>
            <div className="flex items-center gap-3 mb-3">
              <span
                className={`text-[26px] leading-none transition-colors duration-500 ${
                  active === route.id ? "text-[#16C784]" : "text-[#F7F8FA]/30"
                }`}
                aria-hidden
              >
                {route.icon}
              </span>
              <div className="font-display font-medium text-[clamp(20px,3.4vw,46px)] text-[#F7F8FA] leading-[1.04]">
                {route.label}
              </div>
            </div>
            <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#16C784] mb-4">
              ETA · {route.eta}
            </div>
            <p className="font-body text-[15px] text-[#A6ADBB]">{route.desc}</p>
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
        <div className="border-l-2 border-[#16C784] pl-5">
          <p className="font-body text-[clamp(17px,1.4vw,21px)] text-[#F7F8FA]/80 leading-[1.55]">
            Seller receives payout{" "}
            <span className="text-[#F7F8FA]">after the order is confirmed</span> or after
            review resolution.
          </p>
          <p className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB] mt-3">
            [ NOTE — USDC / XLM / MONEYGRAM ONLY · NO BANK TRANSFER · NO BINANCE PAY ]
          </p>
        </div>
      </motion.div>
    </SectionShell>
  )
}
