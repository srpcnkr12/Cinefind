import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { locale as rootLocale } from "next/root-params";
import { notFound } from "next/navigation";
import { messages } from "@movieholix/i18n";
import { routing } from "./routing";

// `next/root-params` (Next.js 16.3+): kök segment `app/[locale]` olduğu için
// bu değeri prop-drilling yapmadan herhangi bir sunucu yardımcı fonksiyonundan okuyabiliriz.
export default getRequestConfig(async () => {
  const requested = await rootLocale();

  if (!hasLocale(routing.locales, requested)) {
    notFound();
  }

  return {
    locale: requested,
    messages: messages[requested],
  };
});
