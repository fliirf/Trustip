"use client"

import { useState } from "react"
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, type MotionValue } from "framer-motion"
import { EASE } from "./motion-presets"

const NODES = [
  { id: "buyer", label: "BUYER", x: 20, y: 50, color: "#EDEAE3" },
  { id: "escrow", label: "ESCROW", x: 50, y: 30, color: "#EDEAE3" },
  { id: "seller", label: "SELLER", x: 80, y: 50, color: "#EDEAE3" },
  { id: "admin", label: "ADMIN", x: 50, y: 75, color: "#EDEAE3" },
]

const EDGES = [
  { from: "buyer", to: "escrow" },
  { from: "escrow", to: "seller" },
  { from: "seller", to: "admin" },
  { from: "admin", to: "buyer" },
  { from: "admin", to: "escrow" },
]

/** Satellite constellation — completed protected orders orbiting the pair. */
const SATELLITES = [
  { id: "s1", parent: "seller", x: 91, y: 40 },
  { id: "s2", parent: "seller", x: 94, y: 56 },
  { id: "s3", parent: "seller", x: 86, y: 67 },
  { id: "s4", parent: "buyer", x: 9, y: 40 },
  { id: "s5", parent: "buyer", x: 6, y: 57 },
  { id: "s6", parent: "escrow", x: 42, y: 16 },
  { id: "s7", parent: "escrow", x: 60, y: 18 },
]

type TrustGraphCanvasProps = {
  className?: string
  /** Optional section scroll progress (0-1) — sequences node activation instead of a fixed stagger. */
  progress?: MotionValue<number>
}

export function TrustGraphCanvas({ className = "", progress }: TrustGraphCanvasProps) {
  const reduce = useReducedMotion()
  const [hovered, setHovered] = useState<string | null>(null)
  const [activeCount, setActiveCount] = useState(progress ? 1 : NODES.length)

  const fallbackProgress = useMotionValue(0)
  useMotionValueEvent(progress ?? fallbackProgress, "change", (v) => {
    if (!progress) return
    const count = Math.max(1, Math.ceil(v * NODES.length * 1.3))
    setActiveCount(Math.min(NODES.length, count))
  })

  return (
    <svg viewBox="0 0 100 100" className={`w-full h-full ${className}`}>
      {EDGES.map((edge, i) => {
        const from = NODES.find((n) => n.id === edge.from)!
        const to = NODES.find((n) => n.id === edge.to)!
        const fromActive = NODES.findIndex((n) => n.id === edge.from) < activeCount
        const toActive = NODES.findIndex((n) => n.id === edge.to) < activeCount
        const live = fromActive && toActive
        const touchesHover = hovered === edge.from || hovered === edge.to
        return (
          <motion.line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={touchesHover ? "#FF2D00" : live ? "rgba(237,234,227,0.14)" : "rgba(237,234,227,0.05)"}
            strokeWidth={touchesHover ? "0.6" : "0.3"}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: live ? 1 : 0, opacity: live ? 1 : 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: reduce ? 0 : i * 0.06 }}
          />
        )
      })}
      {/* Satellites — appear once the core graph has resolved */}
      {SATELLITES.map((sat, i) => {
        const parent = NODES.find((n) => n.id === sat.parent)!
        const allActive = activeCount >= NODES.length
        const lit = hovered === sat.parent
        return (
          <motion.g
            key={sat.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: allActive ? 1 : 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: reduce ? 0 : 0.2 + i * 0.06 }}
          >
            <line
              x1={parent.x}
              y1={parent.y}
              x2={sat.x}
              y2={sat.y}
              stroke={lit ? "rgba(255,45,0,0.5)" : "rgba(237,234,227,0.1)"}
              strokeWidth="0.2"
            />
            <circle
              cx={sat.x}
              cy={sat.y}
              r={lit ? "1.1" : "0.8"}
              fill={lit ? "#FF2D00" : "rgba(198,194,184,0.7)"}
            />
          </motion.g>
        )
      })}

      {NODES.map((node, i) => {
        const active = i < activeCount
        const isHovered = hovered === node.id
        return (
          <motion.g
            key={node.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: active ? 1 : 0.25, scale: active ? 1 : 0.7 }}
            transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : 0.1 + i * 0.05 }}
            style={{ transformOrigin: `${node.x}px ${node.y}px`, cursor: "pointer" }}
            onHoverStart={() => setHovered(node.id)}
            onHoverEnd={() => setHovered(null)}
          >
            <circle cx={node.x} cy={node.y} r={isHovered ? "5.2" : "4"} fill={node.color} opacity={active ? 0.9 : 0.5} />
            <motion.circle
              cx={node.x}
              cy={node.y}
              r="6"
              fill="none"
              stroke={node.color}
              strokeWidth="0.3"
              opacity="0.4"
              animate={
                reduce
                  ? undefined
                  : isHovered
                    ? { r: [6, 9, 6], opacity: [0.6, 0.15, 0.6] }
                    : { r: [6, 8, 6], opacity: [0.4, 0.1, 0.4] }
              }
              transition={{ duration: isHovered ? 1.2 : 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
            />
            <text
              x={node.x}
              y={node.y + 10}
              textAnchor="middle"
              fill={node.color}
              fontFamily="JetBrains Mono, monospace"
              fontSize={isHovered ? "4" : "3.5"}
              letterSpacing="0.18em"
              opacity={isHovered ? 0.95 : 0.6}
            >
              {node.label}
            </text>
          </motion.g>
        )
      })}
    </svg>
  )
}
