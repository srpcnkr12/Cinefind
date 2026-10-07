import { messages, type Locale, type Messages } from "@movieholix/i18n";
import { brand } from "@movieholix/config/brand";
import * as Localization from "expo-localization";

export function resolveLocale(): Locale {
  const preferred = Localization.getLocales()[0]?.languageCode;
  return (brand.locales as readonly string[]).includes(preferred ?? "")
    ? (preferred as Locale)
    : brand.defaultLocale;
}

/** Faz 0'da kurulan doğrudan-erişim deseni (i18next çalışma zamanı yok, bkz. CLAUDE.md). */
export function useMessages(): Messages {
  return messages[resolveLocale()];
}
