"use client"

import { motion, useReducedMotion } from "framer-motion"

type ScanSweepProps = {
  className?: string
  /** When false, the sweep freezes — used once the chamber has "resolved". */
  active?: boolean
}

/**
 * A verification-machine scan line sweeping across a plate. Escrow Proof's
 * motion grammar is scan → resolve → lock, distinct from Hero's ambient
 * orbit or Checkout's staged gate.
 */
export function ScanSweep({ className = "", active = true }: ScanSweepProps) {
  const reduce = useReducedMotion()

  return (
    <div aria-hidden className={`pointer-events-none overflow-hidden ${className}`}>
      <motion.div
        className="absolute inset-y-0 w-1/3"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,45,0,0.16) 45%, rgba(255,45,0,0.32) 50%, rgba(255,45,0,0.16) 55%, transparent 100%)",
        }}
        animate={reduce || !active ? { x: "150%", opacity: 0.15 } : { x: ["-100%", "220%"] }}
        transition={
          reduce || !active
            ? { duration: 0.4 }
            : { duration: 3.2, repeat: Infinity, ease: "linear" }
        }
      />
    </div>
  )
}
