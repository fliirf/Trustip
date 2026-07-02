"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { SmoothScroll } from "@/components/void/smooth-scroll"
import { Cursor } from "@/components/void/cursor"
import { Grain } from "@/components/void/grain"
import { ScrollProgress } from "@/components/void/scroll-progress"
import { BackgroundSystem } from "@/components/void/background-system"
import { PrototypeBadge } from "./PrototypeBadge"
import { LandingNav } from "./LandingNav"
import { HeroSection } from "../sections/HeroSection"
import { ProblemSection } from "../sections/ProblemSection"
import { ProtectedCheckoutSection } from "../sections/ProtectedCheckoutSection"
import { EscrowProofSection } from "../sections/EscrowProofSection"
import { ManifestoSection } from "../sections/ManifestoSection"
import { SocialCommerceSection } from "../sections/SocialCommerceSection"
import { SellerTrustSection } from "../sections/SellerTrustSection"
import { PayoutRouteSection } from "../sections/PayoutRouteSection"
import { FinalCTASection } from "../sections/FinalCTASection"

const EASE = [0.16, 1, 0.3, 1] as const

export function TrustipLandingPage() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <SmoothScroll>
        <Cursor />
        <Grain />
        <ScrollProgress />
        <BackgroundSystem />
        <LandingNav />
        <PrototypeBadge />

        {/* Loading screen */}
        <AnimatePresence>
          {!loaded && (
            <motion.div
              className="fixed inset-0 z-[10001] bg-[#020204] flex items-center justify-center"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="flex flex-col items-center gap-3"
              >
                <div className="font-display font-medium text-[clamp(36px,7vw,96px)] text-[#F7F8FA] leading-[0.92]">
                  TRUSTIP<span className="text-[#16C784]">.</span>
                </div>
                <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#A6ADBB]">
                  ● PROTOTYPE / DEMO
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="relative z-10 pt-14 lg:pt-0">
          <HeroSection />
          <ProblemSection />
          <ProtectedCheckoutSection />
          <EscrowProofSection />
          <ManifestoSection />
          <SocialCommerceSection />
          <SellerTrustSection />
          <PayoutRouteSection />
          <FinalCTASection />
        </main>
      </SmoothScroll>

      {/* Console warning */}
      {typeof window !== "undefined" && (
        <script
          dangerouslySetInnerHTML={{
            __html: `console.warn("[TRUSTIP PROTOTYPE] This is a visual prototype. No real blockchain/wallet activity occurs.")`,
          }}
        />
      )}
    </>
  )
}
