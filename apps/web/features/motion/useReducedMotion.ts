"use client";

import { useEffect, useState } from "react";

/** Reactive `prefers-reduced-motion`. SSR-safe: starts `false` on the server and
    first client paint, then syncs on mount and whenever the OS setting changes.
    Components gate their animations on this. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
