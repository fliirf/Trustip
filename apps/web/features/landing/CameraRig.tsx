"use client";

/* The camera rig. One client island; it owns every object that survives more
   than one chapter, so nothing on this page has to be created or destroyed at a
   chapter boundary.

   Continuity objects under its control:

     • the Escrow Core   — mounted once, fixed to the viewport, never remounted
     • the protocol grid — rotates slowly as the page descends
     • the ambient wash  — darkens as the page descends
     • the hairline spine — draws itself through Proof, Platform and the CTA

   The Core is not a component the chapters reuse. It is a single object the
   camera travels around. Each chapter declares the framing it wants, and the rig
   tweens the Core into that framing over the approach to the chapter, i.e.
   between the moment the chapter's top touches the bottom of the viewport and
   the moment it reaches the top. So the Core is always mid-move while two
   chapters are on screen at once: there is no frame in which it is "at rest in
   chapter N" and then jumps.

   Life of the Core:

     hero      full, lit, dead centre      the object is introduced
     conflict  small, dim, far away        it recedes; the fragments fall into it
     thesis    tiny, drifted off-axis      almost forgotten behind the type
     protocol  full, lit, dead centre      the camera arrives; it is the subject
     proof     a watermark behind the text
     platform  fainter still, other side
     closing   large and dim: only the aura

   All of it is transform + opacity on one fixed element. Reduced motion gets no
   rig at all: CSS parks the Core at a quiet ambient size (see globals.css) and
   every chapter renders its own content statically. */

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { OrbitalCore } from "./OrbitalCore";

/** Opacity of each light. Omit a key to leave that light where the last chapter
    put it, so the lighting is a continuous ramp rather than a sequence of cues. */
type Lighting = Partial<Record<"cold" | "blood" | "technical", number>>;

type Framing = {
  /** Chapter whose approach drives the move. */
  sel: string;
  scale: number | (() => number);
  opacity: number;
  /** Horizontal drift as a fraction of the viewport. Desktop only. */
  driftX?: number;
  light: Lighting;
};

const LIGHT_SELECTOR = { cold: ".light-cold", blood: ".light-blood", technical: ".light-technical" } as const;

export function CameraRig() {
  const inner = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const core = inner.current;
    if (!core) return;
    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();
    mm.add(
      {
        isDesktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        isMobile: "(max-width: 767px) and (prefers-reduced-motion: no-preference)",
      },
      (ctx) => {
        const isDesktop = Boolean(ctx.conditions?.isDesktop);
        const drift = (f: number) => (isDesktop ? window.innerWidth * f : 0);

        /* The opening framing. Every tween below is `immediateRender: false`, so
           none of them may write to the Core before its own scroll range is
           entered — otherwise the last one created would silently define what the
           hero looks like. */
        gsap.set(core, { scale: 1, opacity: 1, x: 0 });

        /* The protocol chapter is the one framing that must land on an exact
           number: the Core has to sit inside the lock ring its diagram draws.
           The ring is 29.2% of the diagram's width, the Core 26% — so measure
           the diagram rather than guessing a scale that only holds at 1440px.
           `offsetWidth` is the untransformed layout width, so this stays correct
           however far the rig has already scaled the Core. */
        const protocolScale = () => {
          const svg = document.querySelector("#protocol svg");
          const natural = core.offsetWidth;
          if (!svg || !natural) return 0.36;
          const width = svg.getBoundingClientRect().width;
          return width ? (width * 0.26) / natural : 0.36;
        };

        /* Camera + lighting share one schedule. Both run across a chapter's
           APPROACH, never on its arrival, so the room is always already changing
           colour while the previous chapter is still on screen. The protocol's
           blood light therefore leaks backwards into the thesis, and the
           technical blue is up before the platform's code is legible. */
        const FRAMINGS: Framing[] = [
          { sel: "#conflict", scale: 0.34, opacity: 0.18, light: { cold: 0.12, blood: 0.22 } },
          { sel: "#thesis", scale: 0.26, opacity: 0.08, driftX: 0.3, light: { blood: 0.3 } },
          { sel: "#protocol", scale: protocolScale, opacity: 1, light: { cold: 0.05, blood: 0.55 } },
          { sel: "#proof", scale: 0.5, opacity: 0.06, driftX: 0.24, light: { cold: 0.1, blood: 0.05, technical: 0.06 } },
          { sel: "#platform", scale: 0.6, opacity: 0.05, driftX: -0.2, light: { blood: 0.02, technical: 0.32 } },
          { sel: "#closing", scale: 1.2, opacity: 0.3, light: { cold: 0.08, blood: 0.2, technical: 0.04 } },
        ];

        /* The opening light. Set explicitly for the same reason as the Core's
           opening framing: every tween below is `immediateRender: false`. */
        gsap.set(".light-cold", { opacity: 0.28 });
        gsap.set([".light-blood", ".light-technical"], { opacity: 0 });

        for (const f of FRAMINGS) {
          const target = document.querySelector(f.sel);
          if (!target) continue;

          const approach = {
            trigger: target,
            // The move runs across the whole approach, so the Core is still
            // travelling while the previous chapter is on screen.
            start: "top bottom",
            end: "top top",
            scrub: 0.8,
            invalidateOnRefresh: true,
            // Refresh last. The rig mounts before the scenes, so at creation
            // time none of their pin spacers exist yet and every start/end here
            // would be computed against a document thousands of pixels shorter.
            refreshPriority: -1,
          } as const;

          gsap.to(core, {
            scale: f.scale,
            opacity: f.opacity,
            x: () => drift(f.driftX ?? 0),
            ease: "none",
            immediateRender: false,
            scrollTrigger: { ...approach },
          });

          for (const [key, value] of Object.entries(f.light)) {
            gsap.to(LIGHT_SELECTOR[key as keyof typeof LIGHT_SELECTOR], {
              opacity: value,
              ease: "none",
              immediateRender: false,
              scrollTrigger: { ...approach },
            });
          }
        }

        /* The Core absorbs the conflict. While the fragments are converging onto
           it, it brightens: the chaos is not deleted, it is taken in. This runs
           over the conflict pin, i.e. after the approach tween above has landed
           and before the thesis approach tween begins, so nothing fights over
           `opacity`. */
        const conflict = document.querySelector("#conflict");
        if (conflict) {
          gsap.fromTo(
            core,
            { opacity: 0.18 },
            {
              opacity: 0.4,
              ease: "none",
              immediateRender: false,
              scrollTrigger: {
                trigger: conflict,
                start: "top top",
                end: "bottom top",
                scrub: 0.8,
                refreshPriority: -1,
              },
            },
          );
        }

        /* The environment itself drifts. The reader should not be able to name
           the frame in which the background changed. */
        const page = document.querySelector("main");
        if (page) {
          const pageScroll = {
            trigger: page,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.2,
            refreshPriority: -1,
          } as const;

          /* Micro-parallax. Each depth travels a different distance over the whole
             page, and the largest of them is 40px: the reader should feel the
             world has volume, not see it move. The grid also creeps in by 6%,
             which is the only "zoom" in the piece. */
          gsap.to(".landing-grid", {
            rotation: 7,
            y: -30,
            scale: 1.06,
            ease: "none",
            scrollTrigger: { ...pageScroll },
          });
          gsap.to(".landing-dust-far", { y: -24, ease: "none", scrollTrigger: { ...pageScroll } });
          gsap.to(".landing-dust-near", { y: 40, ease: "none", scrollTrigger: { ...pageScroll } });
          gsap.to(".landing-light", { y: -14, ease: "none", scrollTrigger: { ...pageScroll } });
          gsap.to(".landing-telemetry", { y: 18, ease: "none", scrollTrigger: { ...pageScroll } });
          gsap.to(".landing-ambient", { opacity: 0.5, ease: "none", scrollTrigger: { ...pageScroll } });
        }

        /* The spine draws itself as the reader walks Proof into Platform, then
           re-enters the closing frame as the CTA's divider. One motif, two
           segments, both scroll-drawn rather than revealed. */
        const spineWrap = document.querySelector("[data-spine-wrap]");
        const spine = document.querySelector("[data-spine]");
        if (spineWrap && spine) {
          gsap.fromTo(
            spine,
            { scaleY: 0 },
            {
              /* Renders immediately, unlike the Core tweens: the spine must be
                 collapsed from page load so it can draw, and nothing else writes
                 to it. */
              scaleY: 1,
              ease: "none",
              // Starts the moment the wrapper's top clears the viewport bottom,
              // which is while the protocol chapter is still pinned: the spine
              // already exists, off-frame, before Proof is a thing.
              scrollTrigger: { trigger: spineWrap, start: "top bottom", end: "bottom 65%", scrub: 0.6 },
            },
          );
        }

        const closing = document.querySelector("#closing");
        const tail = document.querySelector("[data-spine-tail]");
        if (closing && tail) {
          gsap.fromTo(
            tail,
            { scaleY: 0 },
            {
              /* Renders immediately, unlike the Core tweens: the spine must be
                 collapsed from page load so it can draw, and nothing else writes
                 to it. */
              scaleY: 1,
              ease: "none",
              scrollTrigger: { trigger: closing, start: "top 70%", end: "top 20%", scrub: 0.6 },
            },
          );
        }
      },
    );

    /* The scenes' pins mount after this rig (React runs sibling effects in tree
       order) and each pin spacer lengthens the document. Recompute every start
       and end once the whole page has settled. */
    const settle = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      cancelAnimationFrame(settle);
      mm.revert();
    };
  }, []);

  return (
    <div className="camera-core core-boot" aria-hidden>
      <div ref={inner} className="camera-core-inner">
        <OrbitalCore className="h-full w-full" />
      </div>
    </div>
  );
}
