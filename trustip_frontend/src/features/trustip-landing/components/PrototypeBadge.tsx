"use client"

import { motion } from "framer-motion"

export function PrototypeBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 1.5 }}
      className="fixed top-4 right-4 z-[9999]"
    >
      <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#FF2D00] border border-[#FF2D00]/30 px-3 py-1.5 bg-[#050505]/80 backdrop-blur-sm">
        ◈ PROTOTYPE
      </div>
    </motion.div>
  )
}
