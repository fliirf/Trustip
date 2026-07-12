"use client";

import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, otherLocale } from "../../lib/i18n/config";
import { useDict, useLocale } from "./LocaleProvider";

/** Fixed, always-available language switch. Sets the locale cookie and refreshes
 * so server components re-render in the new language. Mounted once in the root
 * layout, so it appears on every page without touching each header. */
export function LanguageToggle() {
  const locale = useLocale();
  const d = useDict();
  const router = useRouter();
  const next = otherLocale(locale);

  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
        router.refresh();
      }}
      aria-label={d.toggle.switchTo}
      className="terminal-control os-press fixed bottom-4 right-4 z-[60] px-3 py-2 text-xs font-medium tracking-wide text-bone"
    >
      {next.toUpperCase()}
    </button>
  );
}
