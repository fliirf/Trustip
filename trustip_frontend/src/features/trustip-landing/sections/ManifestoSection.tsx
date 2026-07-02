"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { SectionShell } from "../components/SectionShell"
import { PRINCIPLES } from "../data/landing-content"
import { EASE } from "../motion/motion-presets"

function PrincipleRow({
  numeral,
  title,
  body,
  index,
}: {
  numeral: string
  title: string
  body: string
  index: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })
  const numeralY = useTransform(scrollYProgress, [0, 1], [60, -60])

  return (
    <div
      ref={ref}
      className={`relative grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 py-12 md:py-16 ${
        index > 0 ? "border-t border-[rgba(255,255,255,0.08)]" : ""
      }`}
    >
      {/* Ghost roman numeral */}
      <motion.span
        aria-hidden
        style={{ y: numeralY }}
        className="pointer-events-none select-none absolute -left-2 md:left-0 top-1/2 -translate-y-1/2 font-display font-light leading-none text-[rgba(247,248,250,0.06)] text-[clamp(120px,20vw,280px)]"
      >
        {numeral}
      </motion.span>

      <div className="relative z-10 md:col-span-2">
        <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#16C784]">
          Principle {numeral}
        </span>
      </div>

      <div className="relative z-10 md:col-span-10">
        <motion.p
          className="font-display font-medium text-[clamp(28px,4.5vw,60px)] text-[#F7F8FA] leading-[1.05] tracking-[-0.02em] text-balance"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          {title}
        </motion.p>
        <motion.p
          className="mt-4 max-w-xl font-body text-[15px] text-[#A6ADBB] leading-[1.6]"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
        >
          {body}
        </motion.p>
      </div>
    </div>
  )
}

export function ManifestoSection() {
  return (
    <SectionShell id="manifesto">
      <div className="px-5 md:px-10 mb-16 md:mb-20 max-w-3xl">
        <motion.div
          className="flex items-center gap-3 mb-10"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            [05]
          </span>
          <span className="h-px w-8 bg-[rgba(255,255,255,0.08)]" />
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            Protection Principles
          </span>
          <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB]/50 ml-auto">
            [read by scrolling]
          </span>
        </motion.div>

        <motion.p
          className="font-display font-normal text-[clamp(36px,7vw,96px)] text-[#F7F8FA] leading-[0.92] tracking-[-0.03em]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          Five rules the protocol never breaks.
        </motion.p>
      </div>

      <div className="relative z-10 px-5 md:px-10">
        {PRINCIPLES.map((p, i) => (
          <PrincipleRow key={p.numeral} numeral={p.numeral} title={p.title} body={p.body} index={i} />
        ))}
      </div>
    </SectionShell>
  )
}
