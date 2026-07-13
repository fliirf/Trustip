// Locale configuration — shared by server and client (no runtime imports, safe
// everywhere). Indonesian is the default (CLAUDE.md buyer-language rules);
// English is an opt-in mode selected via a cookie, so shared checkout/status
// URLs never change.

export const LOCALES = ["id", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "id";
export const LOCALE_COOKIE = "trustip_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function otherLocale(locale: Locale): Locale {
  return locale === "id" ? "en" : "id";
}
