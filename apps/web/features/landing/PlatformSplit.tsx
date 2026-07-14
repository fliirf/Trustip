"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useDict } from "../i18n/LocaleProvider";

/* CHAPTER 06 — PROTECTED FUNDS. Unlike the protocol chapter, this does not
   replay a buyer-to-seller journey. Four rules close around one balance and
   leave it with only two valid exits. */

export function PlatformSplit() {
  const d = useDict();
  const p = d.landing.platform;
  const root = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();
    mm.add(
      "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
      () => {
        const q = (selector: string) => el.querySelector(selector);
        const top = q("[data-lock-top]");
        const right = q("[data-lock-right]");
        const bottom = q("[data-lock-bottom]");
        const left = q("[data-lock-left]");
        const chamber = q("[data-lock-chamber]");
        const scan = q("[data-lock-scan]");
        const pending = q("[data-lock-pending]");
        const locked = q("[data-lock-locked]");
        const conditions = Array.from(
          el.querySelectorAll("[data-lock-condition]"),
        );
        const outcomes = Array.from(el.querySelectorAll("[data-lock-outcome]"));
        if (
          !top ||
          !right ||
          !bottom ||
          !left ||
          !chamber ||
          !scan ||
          !pending ||
          !locked
        )
          return;

        gsap.set(top, { y: -36, opacity: 0.15 });
        gsap.set(right, { x: 48, opacity: 0.15 });
        gsap.set(bottom, { y: 36, opacity: 0.15 });
        gsap.set(left, { x: -48, opacity: 0.15 });
        gsap.set(chamber, {
          scale: 0.92,
          opacity: 0.45,
          transformOrigin: "50% 50%",
        });
        gsap.set(scan, { scaleX: 0, transformOrigin: "50% 50%" });
        gsap.set(pending, { y: 0, opacity: 1 });
        gsap.set(locked, { y: 8, opacity: 0 });
        gsap.set(conditions, { y: 10, opacity: 0.25 });
        gsap.set(outcomes, { y: 12, opacity: 0.2 });

        gsap
          .timeline({
            scrollTrigger: {
              trigger: el,
              start: "top 82%",
              end: "top 18%",
              scrub: 0.7,
              invalidateOnRefresh: true,
            },
          })
          .to(
            [top, right, bottom, left],
            { x: 0, y: 0, opacity: 1, duration: 0.55, ease: "none" },
            0,
          )
          .to(
            chamber,
            { scale: 1, opacity: 1, duration: 0.55, ease: "none" },
            0,
          )
          .to(
            conditions,
            { y: 0, opacity: 1, stagger: 0.04, duration: 0.28, ease: "none" },
            0.18,
          )
          .to(scan, { scaleX: 1, duration: 0.3, ease: "none" }, 0.38)
          .to(
            pending,
            { y: -8, opacity: 0, duration: 0.16, ease: "none" },
            0.54,
          )
          .to(locked, { y: 0, opacity: 1, duration: 0.22, ease: "none" }, 0.58)
          .to(
            outcomes,
            { y: 0, opacity: 1, stagger: 0.06, duration: 0.28, ease: "none" },
            0.66,
          );
      },
    );

    return () => mm.revert();
  }, []);

  return (
    <section ref={root} id="platform" className="scroll-mt-16 py-14">
      <div className="grid items-center gap-12 md:grid-cols-12 md:gap-8">
        <div className="pl-8 md:col-span-5 md:pl-12">
          <span className="micro-label font-mono-jb text-blood/70">
            {p.kicker}
          </span>
          <h2
            id="platform-heading"
            className="font-display mt-6 max-w-xl text-[clamp(40px,4.2vw,60px)] leading-[0.96] font-normal tracking-tight text-bone"
          >
            {p.headline}
          </h2>
          <p className="mt-6 max-w-md text-[14px] leading-relaxed text-mist md:text-[15px]">
            {p.description}
          </p>
        </div>

        <figure aria-labelledby="platform-heading" className="md:col-span-7">
          <div className="relative overflow-hidden border-y border-hairline px-5 py-6 sm:px-8">
            <div className="flex items-center justify-between">
              <span className="micro-label font-mono-jb text-ash">
                {p.instrumentLabel}
              </span>
              <span className="micro-label font-mono-jb text-blood">
                {p.liveLabel}
              </span>
            </div>

            <div className="relative mt-4 h-48">
              <span
                aria-hidden
                data-lock-top
                className="absolute top-0 left-1/2 h-[calc(50%-4.5rem)] w-px -translate-x-1/2 bg-hairline"
              >
                <span className="absolute right-1/2 bottom-0 h-2 w-2 translate-x-1/2 translate-y-1/2 bg-blood" />
              </span>
              <span
                aria-hidden
                data-lock-right
                className="absolute top-1/2 right-0 h-px w-[calc(50%-6.5rem)] -translate-y-1/2 bg-hairline"
              >
                <span className="absolute top-1/2 left-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-blood" />
              </span>
              <span
                aria-hidden
                data-lock-bottom
                className="absolute bottom-0 left-1/2 h-[calc(50%-4.5rem)] w-px -translate-x-1/2 bg-hairline"
              >
                <span className="absolute top-0 right-1/2 h-2 w-2 translate-x-1/2 -translate-y-1/2 bg-blood" />
              </span>
              <span
                aria-hidden
                data-lock-left
                className="absolute top-1/2 left-0 h-px w-[calc(50%-6.5rem)] -translate-y-1/2 bg-hairline"
              >
                <span className="absolute top-1/2 right-0 h-2 w-2 translate-x-1/2 -translate-y-1/2 bg-blood" />
              </span>

              <div
                data-lock-chamber
                className="absolute top-1/2 left-1/2 flex h-36 w-52 -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-bone/15 bg-void/85 text-center"
              >
                <span
                  aria-hidden
                  className="absolute inset-6 rotate-45 border border-bone/10"
                />
                <span
                  aria-hidden
                  data-lock-scan
                  className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-blood/70"
                />
                <div className="relative z-10">
                  <span className="micro-label font-mono-jb text-ash">
                    {p.assetLabel}
                  </span>
                  <div className="font-display mt-2 text-[44px] leading-none font-medium tracking-tight text-bone">
                    {p.asset}
                  </div>
                  <div className="relative mt-3 h-4">
                    <span
                      data-lock-pending
                      className="micro-label absolute inset-x-0 font-mono-jb text-ash opacity-0"
                    >
                      {p.pendingStatus}
                    </span>
                    <span
                      data-lock-locked
                      className="micro-label absolute inset-x-0 font-mono-jb text-blood"
                    >
                      {p.lockedStatus}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <span className="micro-label font-mono-jb text-ash">
                {p.conditionsLabel}
              </span>
              <ul className="mt-3 grid grid-cols-2 border-t border-hairline sm:grid-cols-4">
                {p.conditions.map((condition) => (
                  <li
                    key={condition}
                    data-lock-condition
                    className="flex items-center gap-3 border-b border-hairline py-2.5 sm:border-b-0 sm:pr-3"
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 shrink-0 bg-blood"
                    />
                    <span className="text-[11px] leading-snug text-mist sm:text-[12px]">
                      {condition}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5">
              <span className="micro-label font-mono-jb text-ash">
                {p.outcomesLabel}
              </span>
              <div className="mt-3 grid grid-cols-2 border-t border-hairline">
                {[p.release, p.refund].map((outcome) => (
                  <div
                    key={outcome.label}
                    data-lock-outcome
                    className="py-3 pr-4"
                  >
                    <span className="micro-label font-mono-jb text-blood/70">
                      {outcome.label}
                    </span>
                    <p className="font-display mt-2 text-[18px] leading-tight tracking-tight text-bone sm:text-[20px]">
                      {outcome.title}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-ash">
                      {outcome.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
