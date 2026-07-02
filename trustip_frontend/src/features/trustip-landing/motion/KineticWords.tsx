"use client"

import { motion } from "framer-motion"
import { EASE } from "./motion-presets"

type KineticWordsProps = {
  text: string
  className?: string
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div"
  delay?: number
}

export function KineticWords({ text, className = "", as = "span", delay = 0 }: KineticWordsProps) {
  const Tag = motion[as as keyof typeof motion] as typeof motion.span
  const words = text.split(" ")

  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10%" }}
      transition={{ staggerChildren: 0.12, delayChildren: delay }}
    >
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom" style={{ paddingBottom: "0.06em" }}>
          <motion.span
            className="inline-block"
            variants={{
              hidden: { y: "120%", rotateX: 45, opacity: 0 },
              visible: {
                y: "0%",
                rotateX: 0,
                opacity: 1,
                transition: { duration: 0.7, ease: EASE },
              },
            }}
          >
            {word}{i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </Tag>
  )
}
