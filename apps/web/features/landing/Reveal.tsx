"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Landing entrance trigger. One IntersectionObserver per block: it flips
    `.rv-in` on the wrapper and disconnects. Descendants declare their own
    entrance with `data-rv="rise|blur|draw-x|draw-y"` (or `.rv-word-in`) and
    stagger with an inline `transitionDelay`, so a section with twelve animated
    parts still costs exactly one observer and zero animation frames from JS.

    Reduced-motion users get no `data-rv` rules at all (the CSS lives inside a
    motion-safe query), so content is already in its final state — the class
    flip is a no-op rather than a fallback. */
export function Reveal({
  children,
  className = "",
  threshold = 0.18,
}: {
  children: ReactNode;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("rv-in");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
