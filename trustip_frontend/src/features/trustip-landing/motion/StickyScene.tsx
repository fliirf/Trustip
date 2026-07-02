"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"

type StickySceneProps = {
  children: React.ReactNode
  className?: string
  height?: string
}

export function StickyScene({ children, className = "", height = "200vh" }: StickySceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.92, 1, 1, 0.95])

  return (
    <div ref={ref} style={{ height }} className="relative">
      <motion.div
        style={{ opacity, scale }}
        className={`sticky top-0 h-svh flex items-center overflow-hidden ${className}`}
      >
        {children}
      </motion.div>
    </div>
  )
}
