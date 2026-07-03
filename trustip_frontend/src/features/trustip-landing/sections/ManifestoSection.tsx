"use client"

import { useRef } from "react"
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion"
import { SectionShell } from "../components/SectionShell"
import { PRINCIPLES } from "../data/landing-content"
import { EASE } from "../motion/motion-presets"

const N = PRINCIPLES.length

/** One pinned principle plate — slides up over the previous as the section scrubs. */
function PrincipleCard({
  numeral,
  title,
  body,
  index,
  progress,
}: {
  numeral: string
  title: string
  body: string
  index: number
  progress: MotionValue<number>
}) {
  const start = index / N
  const end = (index + 1) / N

  // Card enters from below just before its window, then dims and recedes
  // as the next card covers it. Card 0 is present from the start.
  const enterStart = Math.max(start - 0.06, 0)
  const y = useTransform(
    progress,
    [enterStart, start],
    [index === 0 ? "0%" : "110%", "0%"],
  )
  const coverScale = useTransform(progress, [end, Math.min(end + 0.08, 1)], [1, 0.95])
  const coverDim = useTransform(progress, [end, Math.min(end + 0.08, 1)], [1, 0.3])
  const numeralY = useTransform(progress, [start, end], [40, -40])

  return (
    <motion.div
      style={{ y, scale: coverScale, opacity: index === N - 1 ? 1 : coverDim, zIndex: index + 1 }}
      className="absolute inset-x-0 top-0 h-full flex items-center"
    >
      <div className="relative w-full border border-[rgba(237,234,227,0.1)] bg-[#0A0A0A] px-6 md:px-14 py-12 md:py-20 overflow-hidden">
        {/* Ghost roman numeral */}
        <motion.span
          aria-hidden
          style={{ y: numeralY }}
          className="pointer-events-none select-none absolute -left-2 md:left-4 top-1/2 -translate-y-1/2 font-display font-light leading-none text-[rgba(237,234,227,0.06)] text-[clamp(120px,18vw,260px)]"
        >
          {numeral}
        </motion.span>

        <div className="relative z-10 md:pl-40">
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#FF2D00]">
            Principle {numeral}
          </span>
          <p className="mt-4 font-display font-medium text-[clamp(28px,4.5vw,60px)] text-[#EDEAE3] leading-[1.05] tracking-[-0.02em] text-balance">
            {title}
          </p>
          <p className="mt-4 max-w-xl font-body text-[15px] text-[#C6C2B8] leading-[1.6]">
            {body}
          </p>
        </div>

        {/* Stack index punctuation */}
        <span className="absolute bottom-4 right-5 font-mono-jb text-[8px] uppercase tracking-[0.3em] text-[#C6C2B8]/40">
          {String(index + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}
        </span>
      </div>
    </motion.div>
  )
}

/** Flat fallback rows — reduced-motion and small screens. */
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
  return (
    <div
      className={`relative grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 py-10 md:py-14 ${
        index > 0 ? "border-t border-[rgba(237,234,227,0.08)]" : ""
      }`}
    >
      <span
        aria-hidden
        className="pointer-events-none select-none absolute -left-2 md:left-0 top-1/2 -translate-y-1/2 font-display font-light leading-none text-[rgba(237,234,227,0.06)] text-[clamp(120px,20vw,280px)]"
      >
        {numeral}
      </span>
      <div className="relative z-10 md:col-span-2">
        <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#FF2D00]">
          Principle {numeral}
        </span>
      </div>
      <div className="relative z-10 md:col-span-10">
        <p className="font-display font-medium text-[clamp(28px,4.5vw,60px)] text-[#EDEAE3] leading-[1.05] tracking-[-0.02em] text-balance">
          {title}
        </p>
        <p className="mt-4 max-w-xl font-body text-[15px] text-[#C6C2B8] leading-[1.6]">
          {body}
        </p>
      </div>
    </div>
  )
}

export function ManifestoSection() {
  const reduce = useReducedMotion()
  const stackRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: stackRef,
    offset: ["start 0.35", "end end"],
  })

  return (
    <SectionShell id="manifesto">
      <div className="px-5 md:px-10 mb-10 md:mb-14 max-w-3xl">
        <motion.div
          className="flex items-center gap-3 mb-10"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8]">
            [05]
          </span>
          <span className="h-px w-8 bg-[rgba(237,234,227,0.08)]" />
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8]">
            Protection Principles
          </span>
          <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#C6C2B8]/50 ml-auto">
            [read by scrolling]
          </span>
        </motion.div>

        <motion.p
          className="font-display font-normal text-[clamp(36px,7vw,96px)] text-[#EDEAE3] leading-[0.92] tracking-[-0.03em]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          Five rules the protocol never breaks.
        </motion.p>
      </div>

      {reduce ? (
        <div className="relative z-10 px-5 md:px-10">
          {PRINCIPLES.map((p, i) => (
            <PrincipleRow key={p.numeral} numeral={p.numeral} title={p.title} body={p.body} index={i} />
          ))}
        </div>
      ) : (
        <>
          {/* Mobile keeps the flat list; the pinned stack needs viewport height */}
          <div className="relative z-10 px-5 md:hidden">
            {PRINCIPLES.map((p, i) => (
              <PrincipleRow key={p.numeral} numeral={p.numeral} title={p.title} body={p.body} index={i} />
            ))}
          </div>

          {/* Pinned stacked cards — each principle slides over the previous */}
          <div
            ref={stackRef}
            className="relative z-10 hidden md:block px-10"
            style={{ height: `${N * 64 + 60}vh` }}
          >
            <div className="sticky top-[12vh] h-[64vh]">
              {PRINCIPLES.map((p, i) => (
                <PrincipleCard
                  key={p.numeral}
                  numeral={p.numeral}
                  title={p.title}
                  body={p.body}
                  index={i}
                  progress={scrollYProgress}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </SectionShell>
  )
}
