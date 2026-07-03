"use client"

import { useRef } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { Marquee } from "@/components/void/marquee"

type SectionMarqueeProps = {
  items: string[]
  reverse?: boolean
  className?: string
}

/**
 * Full-width kinetic marquee band used as section punctuation between
 * sections — a boundary object, not content. Borrowed from the VOID
 * reference footer band. The band also scrubs horizontally with scroll
 * so its motion couples to the reader's velocity, not just the timer.
 */
export function SectionMarquee({ items, reverse, className = "" }: SectionMarqueeProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })
  const x = useTransform(scrollYProgress, [0, 1], reverse ? [60, -60] : [-60, 60])

  return (
    <div
      ref={ref}
      aria-hidden
      className={`relative border-t border-[rgba(237,234,227,0.08)] bg-[#050505] py-3 overflow-hidden lg:pl-32 ${className}`}
    >
      <motion.div style={{ x: reduce ? 0 : x }}>
        <Marquee items={items} reverse={reverse} />
      </motion.div>
    </div>
  )
}
