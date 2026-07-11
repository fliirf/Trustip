"use client";

/* Hero scroll scene (Step 5). Pins the hero so the escrow core stays anchored
   while the tagline cross-fades from the product line to the protocol line as
   the user scrolls through one viewport. Motivation: state transition — the
   pinned core holds while the message resolves from "what it is" to "how it
   behaves".

   Desktop + motion only, via gsap.matchMedia; mobile and reduced-motion skip
   the pin entirely and keep native scroll with only tagline A visible. The boot
   entrance is CSS on a wrapper, so GSAP here owns the inner A/B elements alone —
   no animation fights over the same property. Fully reverted on unmount. */

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function HeroMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();
    mm.add(
      "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
      () => {
        const a = el.querySelector(".hero-tagline-a");
        const b = el.querySelector(".hero-tagline-b");
        if (!a || !b) return;

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: el,
            start: "top top",
            end: "+=90%",
            pin: true,
            scrub: 0.6,
          },
        });
        tl.to(a, { opacity: 0, y: -20, ease: "none" }, 0).fromTo(
          b,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, ease: "none" },
          0.15,
        );
      },
    );

    return () => mm.revert();
  }, []);

  return <div ref={ref}>{children}</div>;
}
