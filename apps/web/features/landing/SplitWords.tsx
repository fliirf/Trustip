import { Fragment } from "react";

/* Server component. Splits a heading into per-word masks so each word can rise
   out from behind its own bottom edge when its `Reveal` wrapper enters view.

   Server-rendered, not client-split: the words exist in the HTML, so there is no
   post-hydration text reflow and no CLS. Spaces live outside the mask spans, so
   line-breaking behaves exactly as it would on plain text. `aria-label` on the
   heading keeps the sentence intact for screen readers; the split spans are
   hidden from the tree. */
export function SplitWords({
  text,
  step = 45,
  start = 0,
}: {
  text: string;
  /** Per-word stagger in ms. */
  step?: number;
  /** Delay before the first word, in ms. */
  start?: number;
}) {
  const words = text.split(" ");
  return (
    <span aria-hidden>
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span className="rv-word">
            <span className="rv-word-in" style={{ transitionDelay: `${start + i * step}ms` }}>
              {word}
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </span>
  );
}
