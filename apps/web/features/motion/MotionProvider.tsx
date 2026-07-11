"use client";

/* Opt-in motion boundary. Prepares the animation engine — registers GSAP's
   ScrollTrigger plugin and, when explicitly asked, runs a Lenis smooth-scroll
   lifecycle. It animates nothing on its own.

   Server-safe by construction: it renders `children` untouched, so a Server
   Component passed in as children stays server-rendered — mounting this provider
   adds a client effect island, it does NOT client-ify the page tree. Import it
   only on pages that opt in; never wrap the root layout.

   Lenis is off by default (`smoothScroll={false}`) and, even when enabled, is
   skipped for reduced-motion, coarse/touch pointers, and environments without
   matchMedia — those fall back to native scroll. */

import { useEffect, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

export function MotionProvider({
  children,
  smoothScroll = false,
}: {
  children: ReactNode;
  /** Opt into Lenis smooth-scroll for this subtree. Default off. */
  smoothScroll?: boolean;
}) {
  // Register the plugin once, client-only (SSR never touches gsap here).
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
  }, []);

  // Optional Lenis lifecycle, gated and fully torn down on unmount.
  useEffect(() => {
    if (!smoothScroll || typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduced || coarse) return;

    const lenis = new Lenis({ lerp: 0.1 });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, [smoothScroll]);

  return <>{children}</>;
}
