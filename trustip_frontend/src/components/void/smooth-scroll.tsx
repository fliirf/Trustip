"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { motionValue } from "framer-motion";

/* Shared motion values for velocity-based scroll effects */
export const scrollVelocityX = motionValue(0);
export const scrollVelocityY = motionValue(0);
export const scrollProgressGlobal = motionValue(0);

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
    });
    lenisRef.current = lenis;

    let rafId: number;
    let lastScroll = 0;
    let lastTime = performance.now();

    const raf = (time: number) => {
      lenis.raf(time);
      const current = window.scrollY;
      const dt = time - lastTime;
      const delta = current - lastScroll;
      const velocity = dt > 0 ? delta / dt : 0;
      scrollVelocityY.set(velocity);
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      scrollProgressGlobal.set(maxScroll > 0 ? current / maxScroll : 0);
      lastScroll = current;
      lastTime = time;
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
