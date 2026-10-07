import { routing } from "@/i18n/routing";
import { brand } from "@movieholix/config/brand";

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? `https://${brand.domain}`;
}

/**
 * Bir sayfanın (locale hariç) yolu için canonical + hreflang alternates üretir.
 * `path` kök segmentten sonraki kısımdır, örn. "/films/abc-123-uzak".
 */
export function buildAlternates(locale: string, path: string) {
  const siteUrl = getSiteUrl();
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `${siteUrl}/${l}${path}`;
  }
  languages["x-default"] = `${siteUrl}/${routing.defaultLocale}${path}`;

  return {
    canonical: `${siteUrl}/${locale}${path}`,
    languages,
  };
}

export function absoluteUrl(locale: string, path: string): string {
  return `${getSiteUrl()}/${locale}${path}`;
}
