import Link from "next/link";
import { InfoShell } from "../../features/info/InfoShell";
import { getServerLocale, getDict } from "../../lib/i18n/server";

// PHASE 16 — FAQ. Real human questions, short calming answers, zero jargon in
// the questions. Native <details> rows on engraved rules — no client JS.
// Copy is locale-aware (see dictionaries).

export const metadata = {
  title: "Pertanyaan Umum · Trustip",
  description: "Jawaban singkat untuk pertanyaan paling umum tentang Trustip.",
};

export default async function FaqPage() {
  const d = getDict(await getServerLocale()).faq;
  return (
    <InfoShell>
      <section className="py-14">
        <h1 className="os-title text-bone">{d.title}</h1>
        <p className="os-body mt-4 max-w-[52ch] text-mist/80">{d.intro}</p>

        <div className="mt-12">
          {d.items.map(({ q, a }) => (
            <details key={q} className="group engraved-b">
              <summary className="os-press flex list-none items-baseline justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
                <span className="os-body font-medium text-bone">{q}</span>
                <span
                  aria-hidden
                  className="micro-label shrink-0 text-ash group-open:hidden"
                >
                  {d.open}
                </span>
                <span
                  aria-hidden
                  className="micro-label hidden shrink-0 text-blood group-open:inline"
                >
                  {d.close}
                </span>
              </summary>
              <p className="os-body max-w-[56ch] pb-6 text-mist/80">{a}</p>
            </details>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap items-center gap-5 pb-8">
          <Link
            href="/cara-kerja"
            className="os-press micro-label py-2 text-ash hover:text-bone"
          >
            {d.ctaCaraKerja}
          </Link>
          <Link
            href="/buyer"
            className="os-press micro-label py-2 text-ash hover:text-bone"
          >
            {d.ctaBuyer}
          </Link>
        </div>
      </section>
    </InfoShell>
  );
}
