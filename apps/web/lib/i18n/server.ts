import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { dictionaries, type Dict } from "./dictionaries";

/** Read the active locale from the request cookie (server components). Reading a
 * cookie opts routes into dynamic rendering — acceptable for a locale switch. */
export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getDict(locale: Locale): Dict {
  return dictionaries[locale];
}
