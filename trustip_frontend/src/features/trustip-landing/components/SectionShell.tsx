"use client"

import { type ReactNode } from "react"
import { motion } from "framer-motion"
import { EASE } from "../motion/motion-presets"

type SectionShellProps = {
  id: string
  children: ReactNode
  className?: string
  ghostWord?: string
}

export function SectionShell({ id, children, className = "", ghostWord }: SectionShellProps) {
  return (
    <section
      id={id}
      className={`relative w-full overflow-hidden border-t border-[rgba(255,255,255,0.08)] py-24 md:py-36 lg:pl-32 ${className}`}
      style={{ scrollMarginTop: "60px" }}
    >
      {ghostWord && (
        <motion.div
          className="absolute pointer-events-none z-0 select-none"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE }}
          aria-hidden
        >
          <span
            className="font-display font-light leading-none text-[rgba(247,248,250,0.04)]"
            style={{ fontSize: "clamp(140px, 18vw, 320px)" }}
          >
            {ghostWord}
          </span>
        </motion.div>
      )}
      <div className="relative z-10">
        {children}
      </div>
    </section>
  )
}
