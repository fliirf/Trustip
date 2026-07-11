"use client";

/* CHAPTER 03 — THESIS.

   Composition: the only section on the page that moves sideways. Three
   principles, one per full viewport, panned horizontally while the section is
   pinned. No container, no card, no supporting visual — the type is the whole
   composition, set against roughly ninety percent empty space.

   Why sideways: these three statements are not a list, they are a sequence of
   assertions, and a vertical stack invites the eye to compare them like
   features. A horizontal pan forces them to be read one at a time, in order,
   with nothing else on screen. The axis change is also the strongest possible
   signal that the reader has entered a different chapter.

   Mobile and reduced motion: no pin, no pan. The panels stack vertically and
   read as three plain statements. */

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/* Headlines carry the user's stake, in the user's language. The mechanism
   (jaringan Stellar, verification) stays in the small body line, which is where
   metadata lives on this page. */
const PRINCIPLES = [
  {
    numeral: "I",
    title: "Kepercayaan bukan screenshot.",
    body: "Bukti chat dan screenshot transfer tidak melindungi siapa pun. Trustip menggantinya dengan bukti yang tercatat permanen.",
  },
  {
    numeral: "II",
    title: "Bukti bayar tidak bisa dikarang.",
    body: "Tidak ada tombol “saya sudah bayar”. Pembayaran dikonfirmasi dari jaringan Stellar, bukan dari klik.",
  },
  {
    numeral: "III",
    title: "Dana cair setelah pesanan diterima.",
    body: "Dana pindah ke seller hanya setelah pesanan dikonfirmasi diterima, atau setelah peninjauan selesai.",
  },
] as const;

export function ManifestoPan() {
  const root = useRef<HTMLElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = root.current;
    const trackEl = track.current;
    if (!el || !trackEl) return;
    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const distance = () => trackEl.scrollWidth - window.innerWidth;

      gsap.to(trackEl, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <section ref={root} id="thesis" className="relative overflow-hidden">
      <div ref={track} className="flex flex-col md:h-[100dvh] md:flex-row">
        {PRINCIPLES.map((p) => (
          <article
            key={p.numeral}
            className="flex shrink-0 flex-col justify-center px-5 py-24 md:h-full md:w-screen md:px-[12vw] md:py-0"
          >
            <span className="font-display text-[clamp(48px,7vw,120px)] leading-none text-blood/80">
              {p.numeral}
            </span>
            <h2 className="font-display mt-8 max-w-4xl text-[clamp(34px,6.5vw,92px)] leading-[0.92] font-normal tracking-tight text-bone">
              {p.title}
            </h2>
            <p className="mt-10 max-w-sm text-[14px] leading-relaxed text-mist md:mt-16">{p.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
