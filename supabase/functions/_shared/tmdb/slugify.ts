/**
 * packages/i18n/src/slugify.ts ve supabase/migrations'daki normalize_tr() ile
 * aynı Türkçe harf dönüşüm tablosu — üç ortamda tutarlı slug/arama için
 * bilinçli olarak tekrarlanmıştır.
 */
const TURKISH_MAP: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  I: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
};

export function slugify(input: string): string {
  const transliterated = input.replace(
    /[çÇğĞıIİöÖşŞüÜ]/g,
    (ch) => TURKISH_MAP[ch] ?? ch,
  );
  return transliterated
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
