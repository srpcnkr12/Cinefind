import { z } from "zod";

/** PRD bölüm 9.3 — Sinematek (film günlüğü/replikler/istatistik) domain tipleri. */

export const userFilmStatusSchema = z.enum(["watched", "watchlist", "none"]);
export type UserFilmStatus = z.infer<typeof userFilmStatusSchema>;

export const diaryVenueSchema = z.enum(["cinema", "home", "festival", "other"]);
export type DiaryVenue = z.infer<typeof diaryVenueSchema>;

/** `upsert_user_film` RPC'sine gönderilen girdi — hızlı yol, ≤2 dokunuş. */
export const upsertUserFilmInputSchema = z.object({
  filmId: z.uuid(),
  status: userFilmStatusSchema,
  rating: z.number().min(0.5).max(5).nullable().optional(),
  liked: z.boolean().nullable().optional(),
});
export type UpsertUserFilmInput = z.infer<typeof upsertUserFilmInputSchema>;

/** `add_diary_entry` RPC'sine gönderilen girdi. */
export const addDiaryEntryInputSchema = z.object({
  filmId: z.uuid(),
  watchedOn: z.string(),
  rating: z.number().min(0.5).max(5).nullable().optional(),
  isRewatch: z.boolean().optional(),
  venue: diaryVenueSchema.nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  containsSpoiler: z.boolean().optional(),
});
export type AddDiaryEntryInput = z.infer<typeof addDiaryEntryInputSchema>;

/** `add_film_line` RPC'sine gönderilen girdi. */
export const addFilmLineInputSchema = z.object({
  filmId: z.uuid(),
  text: z.string().min(1).max(280),
  characterName: z.string().nullable().optional(),
  containsSpoiler: z.boolean().optional(),
});
export type AddFilmLineInput = z.infer<typeof addFilmLineInputSchema>;

/** `computeFilmStats` girdisi — DB'den gelen ham satırlar, film metadata'sıyla zenginleştirilmiş. */
export type StatsUserFilmRow = {
  status: UserFilmStatus;
  rating: number | null;
  genreSlugs: string[];
  releaseYear: number | null;
};

export type StatsDiaryEntryRow = {
  isRewatch: boolean;
};

export type FilmStats = {
  totalWatched: number;
  totalWatchlist: number;
  ratedCount: number;
  averageRating: number | null;
  rewatchCount: number;
  topGenres: { slug: string; count: number }[];
  topDecade: number | null;
};

/**
 * Saf fonksiyon — Sinematek istatistik ekranı için (FilmDataProvider felsefesiyle
 * aynı ayrıştırma: veri çekme `packages/api`'de, hesaplama burada, test edilebilir).
 */
export function computeFilmStats(
  userFilms: StatsUserFilmRow[],
  diaryEntries: StatsDiaryEntryRow[],
): FilmStats {
  const watched = userFilms.filter((f) => f.status === "watched");
  const watchlist = userFilms.filter((f) => f.status === "watchlist");
  const rated = watched.filter((f) => f.rating !== null);

  const averageRating =
    rated.length > 0
      ? rated.reduce((sum, f) => sum + (f.rating ?? 0), 0) / rated.length
      : null;

  const genreCounts = new Map<string, number>();
  for (const film of watched) {
    for (const slug of film.genreSlugs) {
      genreCounts.set(slug, (genreCounts.get(slug) ?? 0) + 1);
    }
  }
  const topGenres = [...genreCounts.entries()]
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const decadeCounts = new Map<number, number>();
  for (const film of watched) {
    if (film.releaseYear === null) continue;
    const decade = Math.floor(film.releaseYear / 10) * 10;
    decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
  }
  let topDecade: number | null = null;
  let topDecadeCount = 0;
  for (const [decade, count] of decadeCounts) {
    if (count > topDecadeCount) {
      topDecade = decade;
      topDecadeCount = count;
    }
  }

  return {
    totalWatched: watched.length,
    totalWatchlist: watchlist.length,
    ratedCount: rated.length,
    averageRating,
    rewatchCount: diaryEntries.filter((d) => d.isRewatch).length,
    topGenres,
    topDecade,
  };
}
