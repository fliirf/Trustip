"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { motionValue } from "framer-motion";

/* Shared motion values for velocity-based scroll effects */
export const scrollVelocityX = motionValue(0);
export const scrollVelocityY = motionValue(0);
export const scrollProgressGlobal = motionValue(0);

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

    // Mobile / reduced motion: native scroll, but keep the shared progress
    // value fed (RouteThread depends on it) via a cheap passive listener.
    if (prefersReduced || coarsePointer) {
      const onScroll = () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        scrollProgressGlobal.set(maxScroll > 0 ? window.scrollY / maxScroll : 0);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }

    // Desktop: initialize Lenis only once the main thread is idle so smooth
    // scroll never competes with hydration/first interaction. Native scroll
    // works until then.
    let lenis: Lenis | null = null;
    let rafId = 0;

    const start = () => {
      lenis = new Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 1.5,
      });

      let lastScroll = 0;
      let lastTime = performance.now();
      const raf = (time: number) => {
        lenis!.raf(time);
        const current = window.scrollY;
        const dt = time - lastTime;
        const delta = current - lastScroll;
        scrollVelocityY.set(dt > 0 ? delta / dt : 0);
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        scrollProgressGlobal.set(maxScroll > 0 ? current / maxScroll : 0);
        lastScroll = current;
        lastTime = time;
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);
    };

    const w = window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const idleHandle = w.requestIdleCallback
      ? w.requestIdleCallback(start, { timeout: 1500 })
      : window.setTimeout(start, 300);

    return () => {
      if (w.requestIdleCallback && w.cancelIdleCallback) w.cancelIdleCallback(idleHandle as number);
      else clearTimeout(idleHandle as number);
      cancelAnimationFrame(rafId);
      lenis?.destroy();
    };
  }, []);

  return <>{children}</>;
}
