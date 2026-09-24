import { z } from "zod";

/**
 * Film kataloğu domain tipleri (PRD bölüm 9.2). Bu şemalar `packages/api`'nin
 * Supabase sorgu sonuçlarını doğrulaması için tek kaynaktır. Supabase Edge
 * Function'lar (Deno) bu paketi import ETMEZ — kendi dar tiplerini
 * `supabase/functions/_shared/tmdb/types.ts` içinde tutar.
 */

export const localeSchema = z.enum(["tr", "en"]);
export type Locale = z.infer<typeof localeSchema>;

export const genreSchema = z.object({
  id: z.uuid(),
  tmdbId: z.number().int().nullable(),
  slug: z.string(),
});
export type Genre = z.infer<typeof genreSchema>;

export const personSchema = z.object({
  id: z.uuid(),
  tmdbId: z.number().int().nullable(),
  name: z.string(),
  slug: z.string(),
  profilePath: z.string().nullable(),
  knownForDepartment: z.string().nullable(),
  birthday: z.string().nullable(),
  deathday: z.string().nullable(),
  placeOfBirth: z.string().nullable(),
  tmdbPopularity: z.number().nullable(),
});
export type Person = z.infer<typeof personSchema>;

export const filmCreditRoleSchema = z.enum([
  "director",
  "writer",
  "cast",
  "cinematographer",
  "composer",
  "editor",
]);
export type FilmCreditRole = z.infer<typeof filmCreditRoleSchema>;

export const filmCreditSchema = z.object({
  id: z.uuid(),
  filmId: z.uuid(),
  personId: z.uuid(),
  role: filmCreditRoleSchema,
  character: z.string().nullable(),
  billingOrder: z.number().int().nullable(),
});
export type FilmCredit = z.infer<typeof filmCreditSchema>;

export const filmTranslationSchema = z.object({
  filmId: z.uuid(),
  locale: localeSchema,
  title: z.string(),
  tagline: z.string().nullable(),
  overviewSource: z.string().nullable(),
  editorialOverview: z.string().nullable(),
  seoDescription: z.string().nullable(),
});
export type FilmTranslation = z.infer<typeof filmTranslationSchema>;

export const filmSchema = z.object({
  id: z.uuid(),
  tmdbId: z.number().int().nullable(),
  imdbId: z.string().nullable(),
  mediaType: z.literal("movie"),
  originalTitle: z.string(),
  originalLanguage: z.string(),
  releaseDate: z.string().nullable(),
  runtime: z.number().int().nullable(),
  countries: z.array(z.string()),
  posterPath: z.string().nullable(),
  backdropPath: z.string().nullable(),
  tmdbPopularity: z.number().nullable(),
  adult: z.boolean(),
  slug: z.string(),
  tmdbSyncedAt: z.string().nullable(),
});
export type Film = z.infer<typeof filmSchema>;

export const collectionKindSchema = z.enum(["curated", "genre", "mood"]);
export type CollectionKind = z.infer<typeof collectionKindSchema>;

export const collectionSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  kind: collectionKindSchema,
  isPublished: z.boolean(),
  sortOrder: z.number().int(),
  coverFilmIds: z.array(z.uuid()),
});
export type Collection = z.infer<typeof collectionSchema>;

export const collectionTranslationSchema = z.object({
  collectionId: z.uuid(),
  locale: localeSchema,
  title: z.string(),
  intro: z.string().nullable(),
  seoDescription: z.string().nullable(),
});
export type CollectionTranslation = z.infer<typeof collectionTranslationSchema>;

/** `search_films` RPC'sinin dönüş satırı (bkz. supabase/migrations film_catalog). */
export const filmSearchResultSchema = z.object({
  filmId: z.uuid(),
  slug: z.string(),
  title: z.string(),
  originalTitle: z.string(),
  releaseYear: z.number().int().nullable(),
  posterPath: z.string().nullable(),
  similarityScore: z.number(),
});
export type FilmSearchResult = z.infer<typeof filmSearchResultSchema>;

/** TMDB CDN'inden görsel URL'i üretir (bkz. PRD 11.1 — görseller asla kopyalanmaz). */
export const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";
export type TmdbImageSize = "w185" | "w500" | "w1280" | "original";

export function tmdbImageUrl(
  path: string | null,
  size: TmdbImageSize,
): string | null {
  if (!path) return null;
  // Katalog TMDB dışı bir kaynaktan besleniyorsa (ör. gerçek TMDB anahtarı
  // yokken kullanılan fixture kataloğu kendi ürettiğimiz görselleri saklar)
  // `poster_path` mutlak bir URL olur; TMDB tabanıyla birleştirilmemeli.
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${TMDB_IMAGE_BASE_URL}${size}${path}`;
}
