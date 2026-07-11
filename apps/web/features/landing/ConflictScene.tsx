"use client";

/* CHAPTER 02 — CONFLICT. The Core recedes; the chaos falls into it.

   No heading, no card, no container. Ten failure fragments float across the whole
   frame with no grid, no shared column, no shared baseline.

   Continuity, in and out:

     IN   the fragments do not wait for the chapter to begin. They fade up while
          the hero is still on screen, over the approach, so the reader watches
          the next scene arrive inside the current one instead of crossing a
          boundary between them.

     OUT  they converge on the exact centre of the viewport, which is where the
          camera has parked the Escrow Core. They do not scatter away and they do
          not simply fade: they are absorbed, and the Core brightens as they land
          (that brightening is driven by `CameraRig`, over this chapter's pin).

   The convergence is the argument. Ten unrelated scams resolve into one
   structural problem, and the reader performs that resolution with the scroll
   wheel rather than reading a claim about it.

   Mobile and reduced motion: no pin, no convergence. The fragments wrap as a
   static word field with the sentence beneath. Same content, no motion. */

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/* x / y are percentages of the frame. Deliberately un-gridded: no two share a
   column or a row, sizes vary, nothing is centred. */
const FRAGMENTS = [
  { t: "Transfer duluan", x: "6%", y: "16%", size: "text-2xl md:text-4xl", tone: "text-bone" },
  { t: "Chat dihapus", x: "64%", y: "11%", size: "text-xl md:text-3xl", tone: "text-mist" },
  { t: "DP 50%", x: "33%", y: "27%", size: "text-3xl md:text-5xl", tone: "text-bone" },
  { t: "Organizer hilang", x: "73%", y: "32%", size: "text-2xl md:text-4xl", tone: "text-bone" },
  { t: "Tanpa resi", x: "11%", y: "40%", size: "text-lg md:text-2xl", tone: "text-ash" },
  { t: "Barang tidak dikirim", x: "40%", y: "52%", size: "text-2xl md:text-4xl", tone: "text-mist" },
  { t: "Tidak ada jejak", x: "77%", y: "59%", size: "text-xl md:text-3xl", tone: "text-ash" },
  { t: "Screenshot palsu", x: "4%", y: "66%", size: "text-2xl md:text-4xl", tone: "text-mist" },
  { t: "Dana hilang", x: "56%", y: "76%", size: "text-3xl md:text-5xl", tone: "text-blood" },
  { t: "Tanpa perlindungan", x: "24%", y: "84%", size: "text-xl md:text-3xl", tone: "text-ash" },
] as const;

export function ConflictScene() {
  const root = useRef<HTMLElement | null>(null);
  const field = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = root.current;
    const fieldEl = field.current;
    if (!el || !fieldEl) return;
    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const words = Array.from(fieldEl.querySelectorAll<HTMLElement>(".scatter-word"));
      const resolve = fieldEl.querySelector(".conflict-resolve");
      if (!words.length || !resolve) return;

      gsap.set(resolve, { opacity: 0 });

      /* Bleed in: the fragments materialise across the approach, so they are
         already in the frame while the hero occupies the top of it. */
      gsap.from(words, {
        opacity: 0,
        y: 60,
        stagger: 0.05,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "top 20%",
          scrub: 0.6,
        },
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "+=200%",
          pin: true,
          scrub: 0.7,
          invalidateOnRefresh: true,
        },
      });

      /* Converge on the centre of the frame, which is where the camera is
         holding the Core. Each fragment travels 88% of the way, so they crowd
         into it rather than stacking on a single point. */
      words.forEach((word, i) => {
        const delta = (axis: "x" | "y") => () => {
          const f = fieldEl.getBoundingClientRect();
          const w = word.getBoundingClientRect();
          return axis === "x"
            ? (f.width / 2 - (w.left - f.left + w.width / 2)) * 0.88
            : (f.height / 2 - (w.top - f.top + w.height / 2)) * 0.88;
        };
        tl.to(
          word,
          { x: delta("x"), y: delta("y"), opacity: 0, filter: "blur(7px)", ease: "none", duration: 1 },
          i * 0.02,
        );
      });

      tl.to(resolve, { opacity: 1, duration: 0.35 }, 0.74);
    });

    return () => mm.revert();
  }, []);

  return (
    <section
      ref={root}
      id="conflict"
      className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden px-5 py-24 md:px-10"
    >
      {/* On desktop the field IS the frame, so "the centre of the field" and "the
          centre of the viewport" — where the Core sits — are the same point. */}
      <div ref={field} className="relative flex flex-wrap gap-x-8 gap-y-5 md:absolute md:inset-0 md:block">
        {FRAGMENTS.map((f) => (
          <span
            key={f.t}
            className={`scatter-word font-display font-normal tracking-tight ${f.size} ${f.tone}`}
            style={{ ["--x" as string]: f.x, ["--y" as string]: f.y }}
          >
            {f.t}
          </span>
        ))}

        {/* Plain text, not `SplitWords`: this heading's entrance is owned by the
            scrub timeline, and a word-mask would need a second, competing reveal
            trigger inside a pinned section. */}
        <h2 className="conflict-resolve font-display mt-12 max-w-3xl text-[clamp(32px,5.5vw,76px)] leading-[0.95] font-normal tracking-tight md:mt-0 md:max-w-4xl md:text-center">
          Social commerce berjalan di atas kepercayaan buta.
        </h2>
      </div>
    </section>
  );
}
