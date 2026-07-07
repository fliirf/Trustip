"use client"

import { useEffect } from "react"
import dynamic from "next/dynamic"
import { SmoothScroll } from "@/components/void/smooth-scroll"
import { Cursor } from "@/components/void/cursor"
import { Grain } from "@/components/void/grain"
import { ScrollProgress } from "@/components/void/scroll-progress"
import { BackgroundSystem } from "@/components/void/background-system"
import { RouteThread } from "../motion/RouteThread"
import { PrototypeBadge } from "./PrototypeBadge"
import { SectionMarquee } from "./SectionMarquee"
import { RISK_WORDS } from "../data/landing-content"
import { LandingNav } from "./LandingNav"
import { LazySection } from "./LazySection"
import { HeroSection } from "../sections/HeroSection"
import { ProblemSection } from "../sections/ProblemSection"

/* Below-the-fold cinematic sections — split out of the initial bundle and
   mounted only as they approach the viewport (via LazySection). */
const ProtectedCheckoutSection = dynamic(() =>
  import("../sections/ProtectedCheckoutSection").then((m) => m.ProtectedCheckoutSection),
)
const EscrowProofSection = dynamic(() =>
  import("../sections/EscrowProofSection").then((m) => m.EscrowProofSection),
)
const ManifestoSection = dynamic(() =>
  import("../sections/ManifestoSection").then((m) => m.ManifestoSection),
)
const SocialCommerceSection = dynamic(() =>
  import("../sections/SocialCommerceSection").then((m) => m.SocialCommerceSection),
)
const SellerTrustSection = dynamic(() =>
  import("../sections/SellerTrustSection").then((m) => m.SellerTrustSection),
)
const PayoutRouteSection = dynamic(() =>
  import("../sections/PayoutRouteSection").then((m) => m.PayoutRouteSection),
)
const FinalCTASection = dynamic(() =>
  import("../sections/FinalCTASection").then((m) => m.FinalCTASection),
)

export function TrustipLandingPage() {
  useEffect(() => {
    console.warn(
      "[TRUSTIP PROTOTYPE] This is a visual prototype. No real blockchain/wallet activity occurs.",
    )
  }, [])

  return (
    <>
      <SmoothScroll>
        <Cursor />
        <Grain />
        <ScrollProgress />
        <BackgroundSystem />
        {/* Viewport vignette — cinematic edge falloff over everything */}
        <div
          aria-hidden
          className="fixed inset-0 pointer-events-none z-[60]"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.32) 88%, rgba(0,0,0,0.5) 100%)",
          }}
        />
        <LandingNav />
        <RouteThread />
        <PrototypeBadge />

        {/* Loading splash — pure CSS fade so it never blocks first paint on JS.
            Server-rendered, fades out on its own even before hydration. */}
        <div className="fixed inset-0 z-[10001] bg-[#050505] flex items-center justify-center pointer-events-none splash-out">
          <div className="flex flex-col items-center gap-3">
            <div className="font-display font-medium text-[clamp(36px,7vw,96px)] text-[#EDEAE3] leading-[0.92]">
              TRUSTIP<span className="text-[#FF2D00]">.</span>
            </div>
            <div className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8]">
              ● PROTOTYPE / DEMO
            </div>
          </div>
        </div>

        <main className="relative z-10 pt-14 lg:pt-0">
          <HeroSection />
          <ProblemSection />
          <SectionMarquee items={RISK_WORDS} reverse />
          <LazySection><ProtectedCheckoutSection /></LazySection>
          <LazySection><EscrowProofSection /></LazySection>
          <LazySection><ManifestoSection /></LazySection>
          <LazySection><SocialCommerceSection /></LazySection>
          <LazySection><SellerTrustSection /></LazySection>
          <LazySection><PayoutRouteSection /></LazySection>
          <LazySection minHeightClass="min-h-[80dvh]"><FinalCTASection /></LazySection>
        </main>
      </SmoothScroll>

    </>
  )
}
