"use client"

import { motion } from "framer-motion"
import { EASE } from "./motion-presets"
import { ScrambleText } from "./ScrambleText"
import type { MockProofItem } from "../types"

type ProofRailProps = {
  items: MockProofItem[]
  className?: string
}

export function ProofRail({ items, className = "" }: ProofRailProps) {
  return (
    <div className={`border border-[rgba(237,234,227,0.08)] ${className}`}>
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
          className="flex items-center justify-between px-5 py-3 border-b border-[rgba(237,234,227,0.06)] last:border-b-0"
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.18em] text-[#B9B5AB]">
            {item.label}
          </span>
          {item.mono ? (
            <ScrambleText
              text={item.value}
              className={`font-mono-jb text-[13px] ${item.accent ? "text-[#FF2D00]" : "text-[#EDEAE3]"}`}
            />
          ) : (
            <span
              className={`font-mono-jb text-[13px] ${item.accent ? "text-[#FF2D00]" : "text-[#EDEAE3]"}`}
            >
              {item.value}
            </span>
          )}
        </motion.div>
      ))}
    </div>
  )
}
