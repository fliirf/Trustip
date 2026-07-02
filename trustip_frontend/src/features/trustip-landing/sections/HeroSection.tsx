"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { KineticWords } from "../motion/KineticWords"
import { WalletCTAButton } from "../components/WalletCTAButton"
import { CTAButton } from "../components/CTAButton"
import { EASE } from "../motion/motion-presets"

export function HeroSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  })

  const wordY = useTransform(scrollYProgress, [0, 1], [0, -100])
  const wordScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.88])
  const metaOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0])

  const letters = ["T", "R", "U", "S", "T", "I", "P"]
  const letterOffsets = [0, -25, -50, -75, -100, -125, -150]
  const letterYs = letterOffsets.map((o) => useTransform(scrollYProgress, [0, 1], [0, o]))

  return (
    <section
      ref={ref}
      id="hero"
      className="relative min-h-[100svh] w-full overflow-hidden"
      style={{ scrollMarginTop: "0px" }}
    >
      {/* Ambient background */}
      <div className="absolute inset-0 z-0 bg-[#020204]">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[900px] max-h-[900px]"
          style={{
            background: "radial-gradient(circle at center, rgba(22,199,132,0.08) 0%, rgba(22,199,132,0.02) 30%, transparent 60%)",
          }}
          aria-hidden
        />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[600px] max-h-[600px]"
          style={{
            background: "radial-gradient(circle at center, rgba(79,140,255,0.05) 0%, transparent 50%)",
          }}
          aria-hidden
        />
      </div>

      {/* Top metadata */}
      <motion.div
        style={{ opacity: metaOpacity }}
        className="relative z-20 flex items-start justify-between px-5 md:px-10 pt-20 md:pt-10 lg:pl-32"
      >
        <div className="flex flex-col gap-1">
          <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            SECTION INDEX
          </div>
          <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]/60">
            [01] — Protected Checkout
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end gap-1">
          <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            STELLAR NATIVE
          </div>
          <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            USDC ESCROW
          </div>
          <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#16C784] flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#16C784] animate-pulse" />
            PROTOTYPE / DEMO
          </div>
        </div>
      </motion.div>

      {/* Center wordmark with per-letter parallax */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[60svh] px-5">
        <motion.div
          style={{ y: wordY, scale: wordScale }}
          className="relative"
          suppressHydrationWarning
        >
          <div className="relative flex">
            {letters.map((letter, i) => (
              <motion.span
                key={i}
                className="font-display font-medium text-[clamp(64px,18vw,280px)] text-[#F7F8FA] leading-none"
                style={{ y: letterYs[i], display: "inline-block" }}
                suppressHydrationWarning
              >
                {letter}
              </motion.span>
            ))}
          </div>
        </motion.div>

        {/* Kinetic headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 1, ease: EASE }}
          className="mt-6 md:mt-10 max-w-2xl text-center"
        >
          <KineticWords
            text="Protected checkout for risky social commerce."
            className="font-display font-normal text-[clamp(36px,7vw,96px)] text-[#F7F8FA] leading-[0.92] tracking-[-0.03em]"
            delay={0.6}
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 1, ease: EASE }}
          className="mt-5 max-w-md text-center font-body text-[clamp(17px,1.4vw,21px)] text-[#A6ADBB] leading-[1.55]"
        >
          A checkout link becomes an{" "}
          <span className="relative inline-block text-[#F7F8FA]">
            escrow contract
            <motion.span
              className="absolute -bottom-0.5 left-0 h-px bg-[#16C784]"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ delay: 1.9, duration: 0.7, ease: EASE }}
            />
          </span>
          . Buyer pays with USDC on Stellar.
        </motion.p>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.9, ease: EASE }}
          className="mt-10 md:mt-14 flex flex-col sm:flex-row items-center gap-4"
        >
          <CTAButton label="Open Protected Checkout" targetId="checkout" />
          <WalletCTAButton label="Preview Wallet Connect" />

          <button
            data-cursor="OPEN"
            onClick={() => {
              document.getElementById("problem")?.scrollIntoView({ behavior: "smooth" })
            }}
            className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB] hover:text-[#F7F8FA] transition-colors duration-300 underline-offset-4 hover:underline"
          >
            See the problem →
          </button>
        </motion.div>
      </div>

      {/* Bottom marquee */}
      <motion.div
        style={{ opacity: metaOpacity }}
        className="absolute bottom-0 left-0 right-0 z-20 border-t border-[rgba(255,255,255,0.08)] py-4 lg:pl-32 overflow-hidden"
      >
        <div className="animate-marquee flex whitespace-nowrap">
          {[
            "PROTECTED CHECKOUT", "USDC ON STELLAR", "SOROBAN ESCROW",
            "SOCIAL COMMERCE", "TRUST PROFILE", "JASTIP", "PRE-ORDER", "GROUP BUY",
          ].map((item, i) => (
            <span key={i} className="flex items-center mx-4">
              <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]/60">
                {item}
              </span>
              <span className="ml-4 text-[#A6ADBB]/20">·</span>
            </span>
          ))}
        </div>
      </motion.div>

      {/* Left edge label */}
      <div className="hidden lg:block absolute left-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
        <span
          className="font-mono-jb text-[9px] uppercase tracking-[0.4em] text-[#A6ADBB]/40"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          [ PROTOCOL // TRUSTIP — SOCIAL COMMERCE ESCROW ]
        </span>
      </div>
    </section>
  )
}
