import type { Dict } from "../../lib/i18n/dictionaries";
import { Reveal } from "./Reveal";

/* CHAPTER 05 — PROOF. Server component apart from one `Reveal` observer.

   Composition: a technical document, not a section. A single hairline runs down
   the left edge; every order state hangs off it as a node with a monospace index
   and one line of annotation. Dense, tight leading, no cards, no grid, no
   centred anything. The right margin carries genuine marginalia, sticky as the
   reader walks the rail, the way a spec sheet keeps its glossary in view.

   This chapter is deliberately the densest on the page. It sits between two
   near-empty ones, so the reader feels the pressure change. */

export function ProofDocument({ d }: { d: Dict }) {
  const p = d.landing.proof;
  return (
    /* `mat-paper`: the chapter is printed on an archival sheet. Laid fibre, a
       cross weft, and one crease of light, masked on the diagonal so the sheet
       dissolves into the void rather than ending on a rectangle. Nothing about
       it is a card, and nothing about it is an image. */
    <section id="proof" className="mat-paper scroll-mt-16 py-28 md:py-40">
      <div>
        {/* No heading. The rail is the document; a title would only name it. */}
        <Reveal className="grid gap-16 md:grid-cols-[minmax(0,1fr)_280px] md:gap-24">
          {/* The states hang off the shared spine, which is drawn by CameraRig and
              continues down through the Platform chapter. This rail owns no rule
              of its own. */}
          <ol className="relative">
            {p.states.map((s, i) => (
              <li
                key={s.label}
                className="relative pb-10 pl-8 last:pb-0 md:pl-12"
                data-rv="rise"
                style={{ transitionDelay: `${180 + i * 80}ms` }}
              >
                {/* The state the order is sitting in is the only powered node on
                    the rail; the rest are milled marks. */}
                <span
                  aria-hidden
                  className={`absolute top-[0.55em] -left-[3px] h-[5px] w-[5px] ${
                    "active" in s && s.active ? "mat-emissive bg-blood" : "bg-mist"
                  }`}
                />
                <div className="flex items-baseline gap-5">
                  <span className="micro-label font-mono-jb text-ash tabular-nums">0{i + 1}</span>
                  <span
                    className={`font-display text-[clamp(20px,2.4vw,34px)] leading-tight font-normal tracking-tight ${
                      "active" in s && s.active ? "text-blood" : "text-bone"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-ash md:text-[14px]">{s.note}</p>
              </li>
            ))}
          </ol>

          {/* Marginalia: sticky, small, unboxed. No ScrollTrigger, just position. */}
          <aside className="md:sticky md:top-28 md:self-start" data-rv="blur" style={{ transitionDelay: "260ms" }}>
            <p className="text-[14px] leading-relaxed text-mist">{p.marginaliaIntro}</p>
            <dl className="mt-10 space-y-5">
              {p.marginalia.map(([tag, copy]) => (
                <div key={tag}>
                  <dt className="micro-label font-mono-jb text-blood/70">{tag}</dt>
                  <dd className="mt-1.5 text-[13px] leading-relaxed text-ash">{copy}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </Reveal>
      </div>
    </section>
  );
}
