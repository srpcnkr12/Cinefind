/**
 * Film/kişi/koleksiyon URL slug'ları için (bkz. PRD 6.3, 16).
 * Türkçe karakterleri aksansız Latin karşılıklarına çevirir, ardından
 * genel slug normalizasyonu uygular. Sonuç yalnızca [a-z0-9-] içerir.
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

// Unicode "Combining Diacritical Marks" bloğu (U+0300–U+036F).
const COMBINING_DIACRITICS_START = 0x0300;
const COMBINING_DIACRITICS_END = 0x036f;

function stripCombiningDiacritics(input: string): string {
  let result = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      code >= COMBINING_DIACRITICS_START &&
      code <= COMBINING_DIACRITICS_END
    ) {
      continue;
    }
    result += ch;
  }
  return result;
}

export function slugify(input: string): string {
  const transliterated = input.replace(
    /[çÇğĞıIİöÖşŞüÜ]/g,
    (ch) => TURKISH_MAP[ch] ?? ch,
  );
  return stripCombiningDiacritics(transliterated.normalize("NFKD"))
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Türkçe locale büyük/küçük harf dönüşümleri (i ↔ İ, ı ↔ I). Bkz. PRD 15.3. */
export function toLocaleUpperTr(input: string): string {
  return input.toLocaleUpperCase("tr-TR");
}

export function toLocaleLowerTr(input: string): string {
  return input.toLocaleLowerCase("tr-TR");
}
