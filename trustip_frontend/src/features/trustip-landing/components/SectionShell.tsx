"use client"

import { type ReactNode } from "react"
import { motion } from "framer-motion"
import { EASE } from "../motion/motion-presets"

type SectionShellProps = {
  id: string
  children: ReactNode
  className?: string
  ghostWord?: string
  /** Attach a scroll-measurement ref to the section element (for useScroll targets). */
  sectionRef?: React.RefObject<HTMLElement | null>
}

export function SectionShell({ id, children, className = "", ghostWord, sectionRef }: SectionShellProps) {
  return (
    <section
      ref={sectionRef}
      id={id}
      className={`relative w-full overflow-hidden border-t border-[rgba(237,234,227,0.08)] py-24 md:py-36 lg:pl-32 ${className}`}
      style={{ scrollMarginTop: "60px" }}
    >
      {/* Top tick ruler — quiet grid logic along the section boundary */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[6px] pointer-events-none opacity-60"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(237,234,227,0.10) 0 1px, transparent 1px 80px)",
        }}
      />

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
            className="font-display font-light leading-none text-[rgba(237,234,227,0.04)]"
            style={{ fontSize: "clamp(140px, 18vw, 320px)" }}
          >
            {ghostWord}
          </span>
        </motion.div>
      )}
      <div className="relative z-10">
        {children}
      </div>

      {/* Bottom-right coordinate punctuation */}
      <span
        aria-hidden
        className="hidden lg:block absolute bottom-5 right-12 font-mono-jb text-[8px] uppercase tracking-[0.4em] text-[#B9B5AB]/30 pointer-events-none select-none"
      >
        GRID · {id}
      </span>
    </section>
  )
}
