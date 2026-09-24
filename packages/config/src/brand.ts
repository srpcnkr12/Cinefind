/**
 * Tek kaynak: uygulama genelinde marka adı/domain/mağaza linkleri buradan okunur.
 * Kalıcı ad netleşince (PRD bölüm 21, karar #1) sadece bu dosya değişir.
 */
export const brand = {
  name: "Reelmate",
  legalName: "Reelmate (placeholder)",
  domain: "reelmate.app",
  supportEmail: "destek@reelmate.app",
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
