import Link from "next/link";
import { InfoShell } from "../../features/info/InfoShell";
import { getServerLocale, getDict } from "../../lib/i18n/server";

// PHASE 16 — "Cara Kerja", the plain-language walkthrough. Five human steps,
// zero blockchain terminology in the main flow; the mechanism lives in one
// expandable disclosure at the bottom. Copy is locale-aware (see dictionaries).

export const metadata = {
  title: "Cara Kerja · Trustip",
  description:
    "Lima langkah pembayaran yang dilindungi Trustip, dari checkout sampai dana diteruskan.",
};

export default async function CaraKerjaPage() {
  const d = getDict(await getServerLocale()).caraKerja;
  return (
    <InfoShell>
      <section className="py-14">
        <h1 className="os-title text-bone">{d.title}</h1>
        <p className="os-body mt-4 max-w-[52ch] text-mist/80">{d.intro}</p>

        {/* The flow, descending one spine — the same rule the status page runs. */}
        <div className="relative mt-14 pl-8">
          <span aria-hidden className="control-spine absolute inset-y-0 left-0" />
          <ol className="space-y-12">
            {d.steps.map((s, i) => (
              <li key={s.title} className="relative">
                <span
                  aria-hidden
                  className="control-node absolute top-[3px] left-[calc(-2rem-2.5px)] size-[7px] bg-void"
                />
                <div className="micro-label text-ash tabular-nums">
                  0{i + 1}
                </div>
                <div className="os-reading mt-2 text-bone">{s.title}</div>
                <p className="os-body mt-2 max-w-[52ch] text-mist/80">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {/* Layer 2 — the mechanism, disclosed on request. Native <details>. */}
        <details className="group engraved-t mt-16 pt-8">
          <summary className="os-press micro-label list-none text-mist hover:text-bone [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="mr-3 text-blood group-open:hidden">
              +
            </span>
            <span aria-hidden className="mr-3 hidden text-blood group-open:inline">
              −
            </span>
            {d.disclosureSummary}
          </summary>
          <div className="mt-5 max-w-[56ch]">
            <p className="os-note text-mist/80">{d.disclosureBody}</p>
            <p className="micro-label mt-4 text-ash">{d.disclosureMeta}</p>
          </div>
        </details>

        <div className="mt-16 flex flex-wrap items-center gap-5 pb-8">
          <Link
            href="/buyer"
            className="mat-illuminated os-press px-6 py-3 text-sm font-semibold tracking-tight text-void hover:text-bone"
          >
            {d.ctaBuyer}
          </Link>
          <Link
            href="/faq"
            className="os-press micro-label py-2 text-ash hover:text-bone"
          >
            {d.ctaFaq}
          </Link>
        </div>
      </section>
    </InfoShell>
  );
}
