"use client"

import { motion, useReducedMotion } from "framer-motion"
import { EASE } from "./motion-presets"

const NODES = [
  { id: "buyer", label: "BUYER", x: 20, y: 50, color: "#F7F8FA" },
  { id: "escrow", label: "ESCROW", x: 50, y: 30, color: "#7B61FF" },
  { id: "seller", label: "SELLER", x: 80, y: 50, color: "#F7F8FA" },
  { id: "admin", label: "ADMIN", x: 50, y: 75, color: "#4F8CFF" },
]

const EDGES = [
  { from: "buyer", to: "escrow" },
  { from: "escrow", to: "seller" },
  { from: "seller", to: "admin" },
  { from: "admin", to: "buyer" },
  { from: "admin", to: "escrow" },
]

export function TrustGraphCanvas() {
  const reduce = useReducedMotion()

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {EDGES.map((edge, i) => {
        const from = NODES.find((n) => n.id === edge.from)!
        const to = NODES.find((n) => n.id === edge.to)!
        return (
          <motion.line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.3"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: EASE, delay: i * 0.1 }}
          />
        )
      })}
      {NODES.map((node, i) => (
        <motion.g
          key={node.id}
          initial={{ opacity: 0, scale: 0 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.3 + i * 0.1 }}
        >
          <circle cx={node.x} cy={node.y} r="4" fill={node.color} opacity="0.8" />
          <motion.circle
            cx={node.x}
            cy={node.y}
            r="6"
            fill="none"
            stroke={node.color}
            strokeWidth="0.3"
            opacity="0.4"
            animate={reduce ? undefined : { r: [6, 8, 6], opacity: [0.4, 0.1, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
          />
          <text
            x={node.x}
            y={node.y + 10}
            textAnchor="middle"
            fill={node.color}
            fontFamily="JetBrains Mono, monospace"
            fontSize="3.5"
            letterSpacing="0.18em"
            opacity="0.6"
          >
            {node.label}
          </text>
        </motion.g>
      ))}
    </svg>
  )
}
