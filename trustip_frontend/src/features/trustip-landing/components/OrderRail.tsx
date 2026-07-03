"use client"

import { motion, useReducedMotion } from "framer-motion"
import { EASE } from "../motion/motion-presets"
import { ORDER_RAIL_STATES, ALT_RAIL_STATE } from "../data/landing-content"

type OrderRailProps = {
  /** Index of the currently active station (0-based). Purely visual demo state. */
  activeIndex?: number
  className?: string
}

/**
 * Full-width order protection rail — the cinematic state sequence from the
 * VOID reference. Completed states leave a thin trail, the active station
 * carries a pulsing halo, upcoming states stay ash. Includes the ALT STATE
 * branch row for the refund-review path. All states are simulated.
 */
export function OrderRail({ activeIndex = 2, className = "" }: OrderRailProps) {
  const reduce = useReducedMotion()
  const count = ORDER_RAIL_STATES.length
  const trailPct = ((activeIndex + 0.5) / count) * 100

  return (
    <div className={`border border-[rgba(237,234,227,0.08)] bg-[#0A0A0A] ${className}`}>
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-[rgba(237,234,227,0.08)] px-5 md:px-7 py-3.5">
        <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#B9B5AB]">
          ORDER RAIL · TRP-DEMO-0042
        </span>
        <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#FF2D00] flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-[#FF2D00]" />
          {ORDER_RAIL_STATES[activeIndex].en} (DEMO)
        </span>
      </div>

      {/* Desktop: horizontal rail */}
      <div className="hidden md:block px-7 pt-10 pb-8">
        <div className="relative">
          {/* Base line + completed trail */}
          <div className="absolute left-0 right-0 top-[7px] h-px bg-[rgba(237,234,227,0.08)]" />
          <motion.div
            className="absolute left-0 top-[7px] h-px bg-[#EDEAE3]/60 origin-left"
            style={{ width: `${trailPct}%` }}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-15%" }}
            transition={{ duration: 1.2, ease: EASE, delay: 0.3 }}
          />

          <div className="relative grid grid-cols-6">
            {ORDER_RAIL_STATES.map((s, i) => {
              const done = i < activeIndex
              const active = i === activeIndex
              return (
                <motion.div
                  key={s.id}
                  className="flex flex-col items-start gap-2"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-15%" }}
                  transition={{ duration: 0.5, ease: EASE, delay: 0.15 + i * 0.1 }}
                >
                  <span
                    className={`font-mono-jb text-[9px] tracking-[0.22em] ${
                      active ? "text-[#FF2D00]" : done ? "text-[#B9B5AB]" : "text-[#B9B5AB]/40"
                    }`}
                  >
                    {s.n}
                  </span>
                  <span className="relative grid place-items-center w-3.5 h-3.5 -ml-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        active
                          ? "bg-[#FF2D00]"
                          : done
                            ? "bg-[#EDEAE3]/80"
                            : "bg-transparent border border-[rgba(237,234,227,0.25)]"
                      }`}
                    />
                    {active && (
                      <motion.span
                        className="absolute inset-0 rounded-full border border-[#FF2D00]/60"
                        animate={reduce ? undefined : { scale: [1, 2, 1], opacity: [0.7, 0, 0.7] }}
                        transition={reduce ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                  </span>
                  <div className="pr-3">
                    <div
                      className={`font-display text-[14px] leading-tight ${
                        active ? "text-[#EDEAE3]" : done ? "text-[#EDEAE3]/70" : "text-[#B9B5AB]/50"
                      }`}
                    >
                      {s.label}
                    </div>
                    <div
                      className={`font-mono-jb text-[8px] uppercase tracking-[0.22em] mt-1 ${
                        active ? "text-[#FF2D00]" : "text-[#B9B5AB]/40"
                      }`}
                    >
                      {s.en}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile: stacked vertical list (reference mobile pattern) */}
      <div className="md:hidden px-5 py-6">
        {ORDER_RAIL_STATES.map((s, i) => {
          const done = i < activeIndex
          const active = i === activeIndex
          return (
            <div key={s.id} className="flex items-start gap-4 py-2.5">
              <div className="flex flex-col items-center pt-1">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    active
                      ? "bg-[#FF2D00]"
                      : done
                        ? "bg-[#EDEAE3]/80"
                        : "bg-transparent border border-[rgba(237,234,227,0.25)]"
                  }`}
                />
                {i < ORDER_RAIL_STATES.length - 1 && (
                  <span className={`w-px h-6 mt-1.5 ${done ? "bg-[#EDEAE3]/40" : "bg-[rgba(237,234,227,0.08)]"}`} />
                )}
              </div>
              <div>
                <div
                  className={`font-display text-[15px] leading-tight ${
                    active ? "text-[#EDEAE3]" : done ? "text-[#EDEAE3]/70" : "text-[#B9B5AB]/50"
                  }`}
                >
                  {s.label}
                </div>
                <div
                  className={`font-mono-jb text-[8px] uppercase tracking-[0.22em] mt-0.5 ${
                    active ? "text-[#FF2D00]" : "text-[#B9B5AB]/40"
                  }`}
                >
                  {s.n} · {s.en}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ALT STATE branch row — refund review path */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-6 items-center border-t border-[rgba(237,234,227,0.08)] px-5 md:px-7 py-5"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.4 }}
      >
        <div className="md:col-span-5 flex items-center gap-4">
          <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#FF2D00]/80 flex items-center gap-2 shrink-0">
            ALT STATE
            <span className="w-1 h-1 rounded-full bg-[#FF2D00]/80" />
          </span>
          <div>
            <div className="font-display text-[17px] text-[#EDEAE3]">{ALT_RAIL_STATE.label} (DEMO)</div>
            <div className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#B9B5AB]/50 mt-0.5">
              {ALT_RAIL_STATE.en}
            </div>
          </div>
        </div>
        <p className="md:col-span-7 font-body text-[13px] text-[#B9B5AB] leading-[1.6] md:text-right">
          {ALT_RAIL_STATE.body}
        </p>
      </motion.div>

      {/* Honesty strip */}
      <div className="border-t border-[rgba(237,234,227,0.06)] px-5 md:px-7 py-2.5">
        <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#B9B5AB]/40">
          ALL RAIL STATES SIMULATED · PROTOTYPE ONLY — NO REAL ORDER
        </span>
      </div>
    </div>
  )
}
