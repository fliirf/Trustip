"use client"

import { motion, useTransform, useReducedMotion, type MotionValue } from "framer-motion"

type ConvergenceFieldProps = {
  className?: string
  /** 0-1 progress of the Final CTA section entering view. */
  progress: MotionValue<number>
}

/** Eight routes converging from the frame edge to the center — echoes Hero's OrbitalCore as a closing bookend. */
const ROUTES = Array.from({ length: 8 }, (_, i) => i * 45)

/**
 * Final CTA's convergence/compression visual — every route line the page has
 * implied (checkout, escrow, payout) collapses to a single resolved point.
 */
export function ConvergenceField({ className = "", progress }: ConvergenceFieldProps) {
  const reduce = useReducedMotion()

  const routeLength = useTransform(progress, [0.05, 0.55], [0, 1])
  const coreScale = useTransform(progress, [0.4, 0.75], [0, 1])
  const coreOpacity = useTransform(progress, [0.35, 0.6], [0, 1])
  const fieldOpacity = useTransform(progress, [0, 0.15, 0.85, 1], [0, 1, 1, 0.4])

  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none select-none ${className}`}
      style={{ opacity: reduce ? 0.5 : fieldOpacity }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        {ROUTES.map((deg) => (
          <motion.line
            key={deg}
            x1="50"
            y1="50"
            x2={50 + Math.cos((deg * Math.PI) / 180) * 62}
            y2={50 + Math.sin((deg * Math.PI) / 180) * 62}
            stroke="rgba(255,45,0,0.45)"
            strokeWidth="0.22"
            style={{ pathLength: reduce ? 1 : routeLength }}
          />
        ))}
        {/* Route terminals */}
        {ROUTES.map((deg) => (
          <motion.circle
            key={`t-${deg}`}
            cx={50 + Math.cos((deg * Math.PI) / 180) * 62}
            cy={50 + Math.sin((deg * Math.PI) / 180) * 62}
            r="0.7"
            fill="rgba(255,45,0,0.5)"
            style={{ opacity: reduce ? 1 : routeLength }}
          />
        ))}
        {/* Orbit echo from the hero core — closing the bookend */}
        <motion.ellipse
          cx="50"
          cy="50"
          rx="34"
          ry="13"
          fill="none"
          stroke="rgba(237,234,227,0.1)"
          strokeWidth="0.2"
          strokeDasharray="2 2.5"
          transform="rotate(-18 50 50)"
          style={{ opacity: reduce ? 1 : coreOpacity }}
        />
        <motion.circle
          cx="50"
          cy="50"
          r="24"
          fill="none"
          stroke="rgba(237,234,227,0.08)"
          strokeWidth="0.2"
          style={{ scale: reduce ? 1 : coreScale, opacity: reduce ? 0.7 : coreOpacity, transformOrigin: "50px 50px" }}
        />
        <motion.circle
          cx="50"
          cy="50"
          r="10"
          fill="none"
          stroke="rgba(255,45,0,0.55)"
          strokeWidth="0.28"
          strokeDasharray="1.5 1.5"
          style={{ scale: reduce ? 1 : coreScale, opacity: reduce ? 1 : coreOpacity, transformOrigin: "50px 50px" }}
        />
        <motion.g
          style={{ scale: reduce ? 1 : coreScale, opacity: reduce ? 1 : coreOpacity, transformOrigin: "50px 50px" }}
        >
          <motion.circle
            cx="50"
            cy="50"
            r="2.4"
            fill="#FF2D00"
            animate={reduce ? undefined : { opacity: [1, 0.6, 1] }}
            transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.g>
      </svg>
    </motion.div>
  )
}
