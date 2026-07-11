"use client";

/* CHAPTER 04 — PROTOCOL. The camera arrives at the Core.

   This scene draws no Core of its own. The Core it frames is the same object the
   reader has been following since the hero, held by `CameraRig` and scaled to sit
   exactly inside the lock ring drawn here. The diagram is centred on the viewport
   so that "the middle of this instrument" and "the middle of the frame" are the
   same point, and the rig can simply stop moving.

   Two cuts were turned into morphs:

     the USDC particle does not vanish at the Core, it BLOOMS into the lock ring.
     One tween scales the particle up by exactly the ratio of the ring's radius to
     its own while the ring resolves out of the same point. The money becomes the
     boundary that holds it.

     at release, the ring collapses back into a particle at the same point, and
     that particle is what continues out to the seller. Nothing appears; nothing
     disappears.

   Everything is transform / opacity / stroke-dashoffset. Degradation: the
   authored SVG is the settled state, GSAP rewinds it to frame one only inside
   its matchMedia branch, so mobile, reduced motion and no-JS get the ambient
   Core plus the four beats as plain text. */

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const BEATS = [
  "Pembeli membayar USDC dari wallet miliknya sendiri.",
  "Dana terkunci di escrow. Pesanan Aman.",
  "Seller mengemas, lalu mengirim pesanan.",
  "Pesanan Diterima. Dana diteruskan ke seller.",
] as const;

const BONE = "237,234,227";
const BLOOD = "#FF2D00";

/* viewBox 0 0 1000 300, Core centred at (500,150). The particle travels all the
   way in to the Core's centre, because that is where it turns into the ring. */
const CENTRE = 500;
const LOCK_R = 146;
const DOT_R = 4.5;
const IN_LEN = CENTRE - 130; // 370
const OUT_LEN = 870 - CENTRE; // 370
/** Scale that grows the particle to exactly the ring's radius. */
const BLOOM = LOCK_R / DOT_R;

export function ProtocolScene() {
  const root = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const q = (s: string) => el.querySelector(s);
      const feedIn = q(".feed-in");
      const feedOut = q(".feed-out");
      const dotIn = q(".dot-in");
      const dotOut = q(".dot-out");
      const lock = q(".core-lock");
      const seller = q(".node-seller");
      const beats = Array.from(el.querySelectorAll(".beat"));
      if (!feedIn || !feedOut || !dotIn || !dotOut || !lock || !seller) return;

      gsap.set(feedIn, { strokeDasharray: IN_LEN, strokeDashoffset: IN_LEN });
      gsap.set(feedOut, { strokeDasharray: OUT_LEN, strokeDashoffset: OUT_LEN });
      // Explicit origins: GSAP scales an SVG node about its bbox top-left.
      gsap.set([dotIn, dotOut], { opacity: 0, transformOrigin: "50% 50%" });
      gsap.set(lock, { opacity: 0, scale: 1 / BLOOM, transformOrigin: "50% 50%" });
      gsap.set(seller, { opacity: 0.25 });
      gsap.set(beats.slice(1), { opacity: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "+=300%",
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // BEAT 1 — payment leaves the buyer and travels into the Core.
      tl.to(dotIn, { opacity: 1, duration: 0.1 }, 0)
        .to(feedIn, { strokeDashoffset: 0, ease: "none", duration: 1 }, 0)
        .to(dotIn, { x: IN_LEN, ease: "none", duration: 1 }, 0);

      // BEAT 2 — MORPH: the particle blooms into the lock. Same point, same
      // instant, one grows out of the other. The ring is not a new object.
      tl.to(dotIn, { scale: BLOOM, opacity: 0, duration: 0.45, ease: "power2.out" }, 1.0)
        .fromTo(
          lock,
          { scale: 1 / BLOOM, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.45, ease: "power2.out" },
          1.0,
        )
        .to(beats[0], { opacity: 0, duration: 0.2 }, 0.95)
        .to(beats[1], { opacity: 1, duration: 0.25 }, 1.1);

      // BEAT 3 — the seller ships. Nothing moves on the rail. That is the point.
      tl.to(beats[1], { opacity: 0, duration: 0.2 }, 1.8)
        .to(beats[2], { opacity: 1, duration: 0.25 }, 1.9)
        .to(seller, { opacity: 1, duration: 0.4 }, 1.9);

      // BEAT 4 — MORPH: the ring collapses back into a particle, and that same
      // particle is what leaves for the seller.
      tl.to(beats[2], { opacity: 0, duration: 0.2 }, 2.55)
        .to(beats[3], { opacity: 1, duration: 0.25 }, 2.7)
        .to(lock, { scale: 1 / BLOOM, opacity: 0, duration: 0.4, ease: "power2.in" }, 2.6)
        .fromTo(
          dotOut,
          { scale: BLOOM, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.4, ease: "power2.in" },
          2.6,
        )
        .to(feedOut, { strokeDashoffset: 0, ease: "none", duration: 0.9 }, 3.0)
        .to(dotOut, { x: OUT_LEN, ease: "none", duration: 0.9 }, 3.0);
    });

    return () => mm.revert();
  }, []);

  return (
    <section ref={root} id="protocol" className="relative min-h-[100dvh] overflow-hidden">
      {/* The instrument is centred on the viewport, not on the section box, so the
          Core the rig is holding lands exactly inside the ring. */}
      <div className="absolute inset-0 hidden items-center px-5 md:motion-safe:flex md:px-10">
        <div className="relative mx-auto w-full max-w-[1300px]">
          <svg aria-hidden viewBox="0 0 1000 300" className="h-auto w-full overflow-visible">
            <g className="node-buyer">
              <rect x="82" y="142" width="16" height="16" fill="none" stroke={`rgba(${BONE},0.6)`} strokeWidth="1" />
              <circle cx="90" cy="150" r="2" fill={`rgba(${BONE},0.9)`} />
            </g>
            <g className="node-seller">
              <rect x="902" y="142" width="16" height="16" fill="none" stroke={`rgba(${BONE},0.6)`} strokeWidth="1" />
              <circle cx="910" cy="150" r="2" fill={`rgba(${BONE},0.9)`} />
            </g>

            {/* The feeds run to the Core's centre. Their inner ends sit under the
                Core itself, so the money is seen to enter rather than to stop. */}
            <line className="feed-in" x1="130" y1="150" x2={CENTRE} y2="150" stroke={`rgba(${BONE},0.28)`} strokeWidth="1" />
            <line className="feed-out" x1={CENTRE} y1="150" x2="870" y2="150" stroke={`rgba(${BONE},0.28)`} strokeWidth="1" />

            {/* Drawn around its own origin so any scale origin is the Core. */}
            <g transform={`translate(${CENTRE} 150)`}>
              <g className="core-lock">
                <circle cx="0" cy="0" r={LOCK_R} fill="none" stroke={BLOOD} strokeWidth="1" strokeDasharray="2 6" />
                <circle cx="0" cy="0" r={LOCK_R + 6} fill="none" stroke={BLOOD} strokeWidth="0.5" opacity="0.35" />
              </g>
            </g>

            <circle className="dot-in" cx="130" cy="150" r={DOT_R} fill={BLOOD} opacity="0" />
            <circle className="dot-out" cx={CENTRE} cy="150" r={DOT_R} fill={BLOOD} opacity="0" />
          </svg>

          <span className="micro-label absolute top-[64%] left-[9%] -translate-x-1/2 font-mono-jb text-mist">
            Pembeli
          </span>
          <span className="micro-label absolute top-[64%] left-[91%] -translate-x-1/2 font-mono-jb text-mist">
            Seller
          </span>
        </div>
      </div>

      {/* One line of copy at a time, parked at the bottom of the frame so it never
          competes with the instrument for the centre. */}
      <div className="absolute inset-x-0 bottom-[12vh] hidden h-16 px-5 md:motion-safe:block md:px-10">
        {BEATS.map((b, i) => (
          <p
            key={b}
            className={`beat absolute inset-x-0 text-center text-[15px] leading-relaxed text-mist md:text-[17px] ${
              i > 0 ? "opacity-0" : ""
            }`}
          >
            {b}
          </p>
        ))}
      </div>

      {/* Mobile / reduced motion: the ambient Core is already behind this, so the
          chapter only has to supply the four beats. */}
      <div className="relative flex min-h-[100dvh] items-center px-5 py-24 md:px-10 md:motion-safe:hidden">
        <ol className="engraved-l mx-auto w-full max-w-[1300px] space-y-8 pl-6">
          {BEATS.map((b, i) => (
            <li key={b}>
              <span className="micro-label font-mono-jb text-blood">0{i + 1}</span>
              <p className="mt-2 max-w-md text-[15px] leading-relaxed text-mist">{b}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
