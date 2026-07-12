"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "../../lib/i18n/config";
import { dictionaries, type Dict } from "../../lib/i18n/dictionaries";

interface LocaleValue {
  locale: Locale;
  d: Dict;
}

const LocaleContext = createContext<LocaleValue>({
  locale: DEFAULT_LOCALE,
  d: dictionaries[DEFAULT_LOCALE],
});

/** Seeds the client locale from the server-resolved cookie value. The whole
 * dictionary (both languages) is static string data, so shipping it to the
 * client is cheap and lets the toggle switch instantly on refresh. */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={{ locale, d: dictionaries[locale] }}>
      {children}
    </LocaleContext.Provider>
  );
}

export const useLocale = (): Locale => useContext(LocaleContext).locale;
export const useDict = (): Dict => useContext(LocaleContext).d;
