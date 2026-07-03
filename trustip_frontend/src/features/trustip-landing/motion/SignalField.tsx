"use client"

import { motion, useReducedMotion } from "framer-motion"

type SignalFieldProps = {
  className?: string
}

/** Deterministic scatter — avoids hydration mismatch from Math.random(). */
const NODES = [
  { x: 8, y: 18, drift: [0, 4, -2, 3, 0], delay: 0, dur: 7.2 },
  { x: 22, y: 62, drift: [0, -3, 2, -4, 0], delay: 0.4, dur: 8.6 },
  { x: 34, y: 12, drift: [0, 2, -3, 1, 0], delay: 1.1, dur: 6.4 },
  { x: 46, y: 80, drift: [0, -4, 3, -2, 0], delay: 0.2, dur: 9.1 },
  { x: 58, y: 34, drift: [0, 3, -2, 4, 0], delay: 1.6, dur: 7.8 },
  { x: 67, y: 58, drift: [0, -2, 3, -3, 0], delay: 0.7, dur: 6.9 },
  { x: 78, y: 20, drift: [0, 4, -3, 2, 0], delay: 1.3, dur: 8.2 },
  { x: 88, y: 68, drift: [0, -3, 2, -4, 0], delay: 0.5, dur: 7.5 },
  { x: 14, y: 90, drift: [0, 3, -4, 2, 0], delay: 1.8, dur: 6.7 },
  { x: 94, y: 40, drift: [0, -2, 4, -3, 0], delay: 0.9, dur: 8.9 },
]

/** Lines that connect, then intermittently drop — signal loss, not decoration. */
const BROKEN_ROUTES = [
  { from: 0, to: 2, flickerDelay: 0.5, flickerDur: 3.2 },
  { from: 2, to: 4, flickerDelay: 1.8, flickerDur: 4.1 },
  { from: 4, to: 6, flickerDelay: 0.9, flickerDur: 3.6 },
  { from: 6, to: 9, flickerDelay: 2.4, flickerDur: 3.9 },
  { from: 1, to: 5, flickerDelay: 1.2, flickerDur: 4.4 },
  { from: 5, to: 7, flickerDelay: 0.3, flickerDur: 3.3 },
  { from: 3, to: 8, flickerDelay: 1.6, flickerDur: 4.7 },
]

/**
 * Problem section's ambient "unstable field" — scattered signal nodes that
 * drift and jitter, with routes between them that flicker and drop out.
 * Represents disrupted trust, not a literal scam UI.
 */
export function SignalField({ className = "" }: SignalFieldProps) {
  const reduce = useReducedMotion()

  return (
    <div aria-hidden className={`pointer-events-none select-none ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        {BROKEN_ROUTES.map((route, i) => {
          const from = NODES[route.from]
          const to = NODES[route.to]
          return (
            <motion.line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="rgba(255,45,0,0.35)"
              strokeWidth="0.28"
              strokeDasharray="1.4 1.6"
              animate={
                reduce
                  ? undefined
                  : { opacity: [0.5, 0.12, 0.5, 0.05, 0.5], pathLength: [1, 0.4, 1, 0.6, 1] }
              }
              transition={
                reduce
                  ? undefined
                  : {
                      duration: route.flickerDur,
                      delay: route.flickerDelay,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
            />
          )
        })}

        {NODES.map((node, i) => (
          <motion.circle
            key={i}
            cx={node.x}
            cy={node.y}
            r="0.8"
            fill="rgba(237,234,227,0.5)"
            animate={
              reduce
                ? undefined
                : {
                    cx: node.drift.map((d) => node.x + d),
                    cy: node.drift.map((d) => node.y - d * 0.6),
                    opacity: [0.65, 0.25, 0.65, 0.2, 0.65],
                  }
            }
            transition={
              reduce
                ? undefined
                : { duration: node.dur, delay: node.delay, repeat: Infinity, ease: "easeInOut" }
            }
          />
        ))}
      </svg>
    </div>
  )
}
