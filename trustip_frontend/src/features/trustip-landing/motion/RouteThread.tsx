"use client"

import { motion, useSpring, useTransform, useReducedMotion } from "framer-motion"
import { scrollProgressGlobal } from "@/components/void/smooth-scroll"

/**
 * A persistent vertical route line on the right gutter, threading the whole
 * page together — the one visual object that survives every section
 * boundary. Balances LandingNav's left rail. Reuses the global scroll
 * progress already tracked by SmoothScroll, so no extra listener is added.
 */
export function RouteThread() {
  const reduce = useReducedMotion()
  const progress = useSpring(scrollProgressGlobal, { stiffness: 120, damping: 26, mass: 0.5 })
  const nodeY = useTransform(progress, [0, 1], ["2%", "96%"])

  return (
    <div
      aria-hidden
      className="hidden lg:flex fixed right-6 top-0 bottom-0 z-40 flex-col items-center pointer-events-none py-8"
    >
      <span
        className="font-mono-jb text-[9px] uppercase tracking-[0.4em] text-[#C6C2B8]/40 mb-4"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      >
        ROUTE
      </span>

      <div className="relative flex-1 w-px bg-[rgba(237,234,227,0.08)]">
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#FF2D00]"
          style={{ top: reduce ? "50%" : nodeY }}
        >
          <motion.span
            className="absolute inset-0 rounded-full border border-[#FF2D00]/50"
            animate={reduce ? undefined : { scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
            transition={reduce ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>

      <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#C6C2B8]/40 mt-4">
        ●
      </span>
    </div>
  )
}
