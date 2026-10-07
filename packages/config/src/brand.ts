/**
 * Tek kaynak: uygulama genelinde marka adı/domain/mağaza linkleri buradan okunur.
 * Ad 2026-10-07'de Reelmate (placeholder) → Movieholix olarak kesinleşti;
 * bkz. docs/adr/0022-brand-rename-movieholix.md.
 */
export const brand = {
  name: "Movieholix",
  legalName: "Movieholix",
  domain: "movieholix.app",
  supportEmail: "destek@movieholix.app",
  defaultLocale: "tr",
  locales: ["tr", "en"] as const,
  appStoreUrl: "",
  playStoreUrl: "",
  social: {
    instagram: "",
    tiktok: "",
    x: "",
  },
} as const;

export type Brand = typeof brand;
export type Locale = (typeof brand.locales)[number];
