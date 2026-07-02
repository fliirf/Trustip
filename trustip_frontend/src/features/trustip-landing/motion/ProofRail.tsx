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
    <div className={`border border-[rgba(255,255,255,0.08)] ${className}`}>
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
          className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.06)] last:border-b-0"
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.18em] text-[#A6ADBB]">
            {item.label}
          </span>
          {item.mono ? (
            <ScrambleText
              text={item.value}
              className={`font-mono-jb text-[13px] ${item.accent ? "text-[#16C784]" : "text-[#F7F8FA]"}`}
            />
          ) : (
            <span
              className={`font-mono-jb text-[13px] ${item.accent ? "text-[#16C784]" : "text-[#F7F8FA]"}`}
            >
              {item.value}
            </span>
          )}
        </motion.div>
      ))}
    </div>
  )
}
