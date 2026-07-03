"use client"

import { useRef, type ReactNode } from "react"
import { motion, useScroll, useTransform } from "framer-motion"

type SectionShellProps = {
  id: string
  children: ReactNode
  className?: string
  ghostWord?: string
  /** Attach a scroll-measurement ref to the section element (for useScroll targets). */
  sectionRef?: React.RefObject<HTMLElement | null>
}

export function SectionShell({ id, children, className = "", ghostWord, sectionRef }: SectionShellProps) {
  const localRef = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: localRef,
    offset: ["start end", "end start"],
  })

  // Multi-layer parallax: ghost word drifts slower than content, content
  // itself eases upward slightly, so section boundaries read as continuity
  // rather than hard black cuts.
  const ghostY = useTransform(scrollYProgress, [0, 1], [80, -80])
  const ghostOpacity = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [0, 1, 1, 0.4])
  const contentY = useTransform(scrollYProgress, [0, 0.3], [28, 0])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.18], [0.35, 1])

  return (
    <section
      ref={(el) => {
        localRef.current = el
        if (sectionRef) sectionRef.current = el
      }}
      id={id}
      className={`relative w-full overflow-clip border-t border-[rgba(237,234,227,0.08)] py-16 md:py-24 lg:pl-32 ${className}`}
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

      {/* Focal glow — soft red-orange radial that parallaxes behind the content,
          replacing flat black with ambient depth. */}
      <motion.div
        aria-hidden
        className="absolute left-[30%] top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] max-w-[900px] max-h-[900px] pointer-events-none z-0"
        style={{
          y: ghostY,
          background:
            "radial-gradient(circle at center, rgba(255,45,0,0.07) 0%, rgba(255,45,0,0.025) 35%, transparent 65%)",
        }}
      />

      {ghostWord && (
        <motion.div
          className="absolute pointer-events-none z-0 select-none"
          style={{ y: ghostY, opacity: ghostOpacity }}
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
      <motion.div style={{ y: contentY, opacity: contentOpacity }} className="relative z-10">
        {children}
      </motion.div>

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
