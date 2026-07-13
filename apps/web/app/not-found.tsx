import Link from "next/link";
import { getServerLocale, getDict } from "../lib/i18n/server";

// 404 in the product's own voice. Without this file Next serves its default
// white page — a jarring identity break on a VOID-black product, and a dead end
// for a buyer who mistyped a checkout link. Uses only existing OS classes.
export default async function NotFound() {
  const dict = getDict(await getServerLocale());
  const d = dict.errors;
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col items-start justify-center px-6 py-16">
      <div className="micro-label text-ash">{d.notFoundTag}</div>
      <h1 className="os-title mt-4 text-bone">{d.notFoundTitle}</h1>
      <p className="os-body mt-4 max-w-[46ch] text-mist">{d.notFoundBody}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/buyer"
          className="mat-illuminated os-press micro-label px-6 py-3.5 text-void hover:text-bone"
        >
          {d.notFoundCta}
        </Link>
        <Link
          href="/"
          className="mat-key os-press micro-label border border-hairline px-6 py-3.5 text-mist hover:text-bone"
        >
          {dict.common.home}
        </Link>
      </div>
    </main>
  );
}
