"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"

type VelocityScrollBandProps = {
  children: React.ReactNode
  className?: string
  speed?: number
}

export function VelocityScrollBand({ children, className = "", speed = 0.5 }: VelocityScrollBandProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  const x = useTransform(scrollYProgress, [0, 1], [`${speed * 20}%`, `-${speed * 20}%`])

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.div style={{ x }} className="flex gap-6 will-change-transform">
        {children}
      </motion.div>
    </div>
  )
}
