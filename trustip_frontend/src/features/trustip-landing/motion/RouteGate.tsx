"use client"

import { useState } from "react"
import { motion, useMotionValueEvent, useReducedMotion, type MotionValue } from "framer-motion"
import { EASE } from "./motion-presets"

type GateStage = {
  id: string
  label: string
}

type RouteGateProps = {
  stages: readonly GateStage[]
  /** 0-1 — how far the passage has staged-transformed. */
  progress: MotionValue<number>
  className?: string
}

/**
 * Protected Checkout's staged passage: a link plate morphs through a
 * verification plate into the escrow plate. Each stage arms in sequence as
 * `progress` advances — a layered transformation, not a single bounce arrow.
 */
export function RouteGate({ stages, progress, className = "" }: RouteGateProps) {
  const reduce = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const step = 1 / Math.max(stages.length - 1, 1)

  useMotionValueEvent(progress, "change", (v) => {
    const idx = Math.round(v / step)
    setActiveIndex(Math.min(stages.length - 1, Math.max(0, idx)))
  })

  return (
    <div className={`flex items-stretch font-mono-jb text-[10px] uppercase tracking-[0.18em] ${className}`}>
      {stages.map((stage, i) => {
        const armed = reduce || i <= activeIndex
        return (
          <div key={stage.id} className="contents">
            {i > 0 && (
              <div className="relative grid place-items-center px-3 border-x border-[rgba(237,234,227,0.08)] overflow-hidden">
                <svg width="18" height="18" viewBox="0 0 18 18" className="overflow-visible">
                  <motion.line
                    x1="1"
                    y1="9"
                    x2="17"
                    y2="9"
                    stroke="#FF2D00"
                    strokeWidth="1.2"
                    initial={false}
                    animate={{ pathLength: armed ? 1 : 0 }}
                    transition={{ duration: 0.5, ease: EASE }}
                  />
                  <motion.path
                    d="M11 4 L17 9 L11 14"
                    fill="none"
                    stroke="#FF2D00"
                    strokeWidth="1.2"
                    initial={false}
                    animate={{ opacity: armed ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: EASE, delay: armed ? 0.3 : 0 }}
                  />
                </svg>
              </div>
            )}
            <div
              className={`flex-1 flex items-center gap-2 px-5 md:px-7 py-3 transition-colors duration-500 ${
                armed ? "text-[#FF2D00]" : "text-[#B9B5AB]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-500 ${
                  armed ? "bg-[#FF2D00]" : "bg-[rgba(185,181,171,0.4)]"
                }`}
              />
              <span className="truncate">{stage.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
