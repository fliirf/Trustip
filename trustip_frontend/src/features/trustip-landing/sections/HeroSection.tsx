"use client"

import { useRef } from "react"
import dynamic from "next/dynamic"
import { motion, useScroll, useTransform } from "framer-motion"
import { useCan3D } from "../three/useCan3D"
import { useIdleReady } from "../three/useIdleReady"
import { KineticWords } from "../motion/KineticWords"
import { OrbitalCore } from "../motion/OrbitalCore"
import { WalletCTAButton } from "../components/WalletCTAButton"
import { CTAButton } from "../components/CTAButton"
import { MetaCluster } from "../components/MetaCluster"
import { EASE } from "../motion/motion-presets"

const HeroParticleField = dynamic(() => import("../three/HeroParticleField"), {
  ssr: false,
})

export function HeroSection() {
  const can3D = useCan3D()
  const idleReady = useIdleReady()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  })

  const wordY = useTransform(scrollYProgress, [0, 1], [0, -100])
  const wordScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.88])
  const metaOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0])

  const letters = ["T", "R", "U", "S", "T", "I", "P"]
  // Unrolled (not .map(useTransform)) — hooks must be called unconditionally, not inside a loop.
  const letterY0 = useTransform(scrollYProgress, [0, 1], [0, 0])
  const letterY1 = useTransform(scrollYProgress, [0, 1], [0, -25])
  const letterY2 = useTransform(scrollYProgress, [0, 1], [0, -50])
  const letterY3 = useTransform(scrollYProgress, [0, 1], [0, -75])
  const letterY4 = useTransform(scrollYProgress, [0, 1], [0, -100])
  const letterY5 = useTransform(scrollYProgress, [0, 1], [0, -125])
  const letterY6 = useTransform(scrollYProgress, [0, 1], [0, -150])
  const letterYs = [letterY0, letterY1, letterY2, letterY3, letterY4, letterY5, letterY6]

  return (
    <section
      ref={ref}
      id="hero"
      className="relative min-h-[100svh] w-full overflow-hidden"
      style={{ scrollMarginTop: "0px" }}
    >
      {/* Void background — plain near-black; the shell's grid/scanlines fill it */}
      <div className="absolute inset-0 z-0 bg-[#050505]" />

      {/* Mouse-reactive particle field behind the wordmark (desktop, lazy).
          Gated on idle so the heavy Three.js chunk never competes with the
          hero text/wordmark for the first paint. */}
      {can3D && idleReady && (
        <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden>
          <HeroParticleField progress={scrollYProgress} />
        </div>
      )}

      {/* Protected-core artifact — the single symbolic escrow object.
          Oversized so the tilted orbits interleave with the wordmark, per the VOID reference. */}
      <OrbitalCore
        progress={scrollYProgress}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1] w-[130vw] h-[130vw] md:w-[100vw] md:h-[100vw] max-w-[1100px] max-h-[1100px]"
      />

      {/* Top metadata — sparse */}
      <motion.div
        style={{ opacity: metaOpacity }}
        className="relative z-20 flex items-start justify-between px-5 md:px-10 pt-20 md:pt-10 lg:pl-32"
      >
        <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-bone-40">
          [01] / Protected Checkout
        </div>
        <div className="hidden md:block font-mono-jb text-[10px] uppercase tracking-[0.22em] text-bone-40 text-right">
          STELLAR NATIVE · PROTOTYPE
        </div>
      </motion.div>

      {/* Center wordmark with per-letter parallax */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[76svh] px-5">
        <motion.div
          style={{ y: wordY, scale: wordScale }}
          className="relative"
          suppressHydrationWarning
        >
          <div className="relative flex items-baseline">
            {letters.map((letter, i) => (
              <motion.span
                key={i}
                className="font-display font-medium text-[clamp(56px,15vw,236px)] text-[#EDEAE3] leading-none"
                style={{ y: letterYs[i], display: "inline-block" }}
                suppressHydrationWarning
              >
                {letter}
              </motion.span>
            ))}
            {/* Logo dot — the orange period, matching the nav + loading wordmark */}
            <motion.span
              className="font-display font-medium text-[clamp(56px,15vw,236px)] text-[#FF2D00] leading-none"
              style={{ y: letterYs[6], display: "inline-block" }}
              suppressHydrationWarning
            >
              .
            </motion.span>
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
            className="font-display font-normal text-[clamp(26px,4.2vw,56px)] text-[#EDEAE3] leading-[1.04] tracking-[-0.02em]"
            delay={0.6}
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 1, ease: EASE }}
          className="mt-5 max-w-md text-center font-body text-[clamp(17px,1.4vw,21px)] text-bone-60 leading-[1.55]"
        >
          A checkout link becomes a{" "}
          <span className="relative inline-block text-[#EDEAE3]">
            protected payment
            <motion.span
              className="absolute -bottom-0.5 left-0 h-px bg-[#FF2D00]"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ delay: 1.9, duration: 0.7, ease: EASE }}
            />
          </span>
          . The buyer pays in USDC on Stellar.
        </motion.p>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.9, ease: EASE }}
          className="mt-10 md:mt-14 flex flex-col sm:flex-row items-center gap-4"
        >
          <CTAButton label="Open Protected Checkout" targetId="checkout" />
          <WalletCTAButton label="Connect a wallet" />

          <button
            data-cursor="OPEN"
            onClick={() => {
              document.getElementById("problem")?.scrollIntoView({ behavior: "smooth" })
            }}
            className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-bone-40 hover:text-[#EDEAE3] transition-colors duration-300 link-underline"
          >
            See the problem
          </button>
        </motion.div>
      </div>

      {/* Lower-right metadata cluster (xl+) — sparse, single instrument */}
      <motion.div
        style={{ opacity: metaOpacity }}
        className="hidden xl:block absolute bottom-24 right-14 z-20"
        aria-hidden
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.8, ease: EASE }}
        >
          <MetaCluster
            align="right"
            rows={[
              { label: "NETWORK", value: "STELLAR TESTNET (DEMO)" },
              { label: "ESCROW", value: "SOROBAN (DEMO)" },
              { label: "MODE", value: "PROTOTYPE", accent: true },
            ]}
          />
        </motion.div>
      </motion.div>

      {/* Bottom marquee */}
      <motion.div
        style={{ opacity: metaOpacity }}
        className="absolute bottom-0 left-0 right-0 z-20 border-t border-fog py-4 lg:pl-32 overflow-hidden"
      >
        <div className="animate-marquee flex whitespace-nowrap">
          {[
            "PROTECTED CHECKOUT", "USDC ON STELLAR", "SOROBAN ESCROW",
            "SOCIAL COMMERCE", "TRUST PROFILE", "JASTIP", "PRE-ORDER", "GROUP BUY",
          ].map((item, i) => (
            <span key={i} className="flex items-center mx-4">
              <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-bone-40">
                {item}
              </span>
              <span className="ml-4 text-bone-20">·</span>
            </span>
          ))}
        </div>
      </motion.div>

      {/* Orbital bleed — the artifact dissolves into black toward the seam so
          it is never hard-clipped when Section 02 arrives. Sits above the orbit
          (z-1) but below content (z-10). */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[38vh] z-[2] pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #050505 82%)" }}
      />
    </section>
  )
}
