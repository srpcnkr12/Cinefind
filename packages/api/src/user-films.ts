import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@reelmate/core/domain/film";
import {
  computeFilmStats,
  type DiaryVenue,
  type FilmStats,
  type StatsDiaryEntryRow,
  type StatsUserFilmRow,
  type UserFilmStatus,
} from "@reelmate/core/domain/sinematek";
import type { FilmListItem } from "./films";

/** `getFilmBySlug`/`searchFilms` ile aynı çeviri seçme deseni (bkz. films.ts). */
function pickTitle(
  rows: { locale: string; title: string }[] | null | undefined,
  originalTitle: string,
  locale: Locale,
): string {
  return (
    rows?.find((r) => r.locale === locale)?.title ??
    rows?.find((r) => r.locale === "en")?.title ??
    originalTitle
  );
}

function releaseYear(date: string | null): number | null {
  return date ? new Date(date).getUTCFullYear() : null;
}

const LIBRARY_FILM_SELECT = `
  id, slug, original_title, release_date, poster_path,
  film_translations(locale, title),
  film_genres(genres(slug))
`;

type LibraryFilmRow = {
  id: string;
  slug: string;
  original_title: string;
  release_date: string | null;
  poster_path: string | null;
  film_translations: { locale: string; title: string }[];
  film_genres: { genres: { slug: string } | null }[];
};

function mapLibraryFilm(row: LibraryFilmRow, locale: Locale): FilmListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: pickTitle(row.film_translations, row.original_title, locale),
    originalTitle: row.original_title,
    releaseYear: releaseYear(row.release_date),
    posterPath: row.poster_path,
  };
}

export type LibraryEntry = {
  film: FilmListItem;
  status: UserFilmStatus;
  rating: number | null;
  liked: boolean | null;
  topFourPosition: number | null;
  watchCount: number;
  firstWatchedOn: string | null;
};

type UserFilmRow = {
  status: UserFilmStatus;
  rating: number | null;
  liked: boolean | null;
  top_four_position: number | null;
  watch_count: number;
  first_watched_on: string | null;
  films: LibraryFilmRow;
};

/** Kullanıcının kendi Sinematek'i — RLS `auth.uid()`'e göre kısıtlar, ekstra filtre gerekmez. */
export async function getMyLibrary(
  db: SupabaseClient,
  locale: Locale,
): Promise<LibraryEntry[]> {
  const { data, error } = await db
    .from("user_films")
    .select(
      `status, rating, liked, top_four_position, watch_count, first_watched_on, films(${LIBRARY_FILM_SELECT})`,
    )
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`getMyLibrary failed: ${error.message}`);
  return ((data ?? []) as unknown as UserFilmRow[]).map((row) => ({
    film: mapLibraryFilm(row.films, locale),
    status: row.status,
    rating: row.rating,
    liked: row.liked,
    topFourPosition: row.top_four_position,
    watchCount: row.watch_count,
    firstWatchedOn: row.first_watched_on,
  }));
}

export type DiaryEntryItem = {
  id: string;
  film: FilmListItem;
  watchedOn: string;
  rating: number | null;
  isRewatch: boolean;
  venue: DiaryVenue | null;
  note: string | null;
  containsSpoiler: boolean;
};

type DiaryEntryRow = {
  id: string;
  watched_on: string;
  rating: number | null;
  is_rewatch: boolean;
  venue: DiaryVenue | null;
  note: string | null;
  contains_spoiler: boolean;
  films: LibraryFilmRow;
};

export async function getMyDiary(
  db: SupabaseClient,
  locale: Locale,
): Promise<DiaryEntryItem[]> {
  const { data, error } = await db
    .from("diary_entries")
    .select(
      `id, watched_on, rating, is_rewatch, venue, note, contains_spoiler, films(${LIBRARY_FILM_SELECT})`,
    )
    .order("watched_on", { ascending: false });
  if (error) throw new Error(`getMyDiary failed: ${error.message}`);
  return ((data ?? []) as unknown as DiaryEntryRow[]).map((row) => ({
    id: row.id,
    film: mapLibraryFilm(row.films, locale),
    watchedOn: row.watched_on,
    rating: row.rating,
    isRewatch: row.is_rewatch,
    venue: row.venue,
    note: row.note,
    containsSpoiler: row.contains_spoiler,
  }));
}

export type FilmLineItem = {
  id: string;
  film: FilmListItem;
  text: string;
  characterName: string | null;
  containsSpoiler: boolean;
};

type FilmLineRow = {
  id: string;
  text: string;
  character_name: string | null;
  contains_spoiler: boolean;
  films: LibraryFilmRow;
};

export async function getMyFilmLines(
  db: SupabaseClient,
  locale: Locale,
): Promise<FilmLineItem[]> {
  const { data, error } = await db
    .from("film_lines")
    .select(
      `id, text, character_name, contains_spoiler, films(${LIBRARY_FILM_SELECT})`,
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getMyFilmLines failed: ${error.message}`);
  return ((data ?? []) as unknown as FilmLineRow[]).map((row) => ({
    id: row.id,
    film: mapLibraryFilm(row.films, locale),
    text: row.text,
    characterName: row.character_name,
    containsSpoiler: row.contains_spoiler,
  }));
}

export async function getMyFilmStats(db: SupabaseClient): Promise<FilmStats> {
  const [
    { data: userFilms, error: userFilmsError },
    { data: diaryRows, error: diaryError },
  ] = await Promise.all([
    db
      .from("user_films")
      .select("status, rating, films(release_date, film_genres(genres(slug)))"),
    db.from("diary_entries").select("is_rewatch"),
  ]);
  if (userFilmsError)
    throw new Error(`getMyFilmStats failed: ${userFilmsError.message}`);
  if (diaryError)
    throw new Error(`getMyFilmStats failed: ${diaryError.message}`);

  const statsInput: StatsUserFilmRow[] = (
    (userFilms ?? []) as unknown as {
      status: UserFilmStatus;
      rating: number | null;
      films: {
        release_date: string | null;
        film_genres: { genres: { slug: string } | null }[];
      };
    }[]
  ).map((row) => ({
    status: row.status,
    rating: row.rating,
    genreSlugs: row.films.film_genres
      .map((g) => g.genres?.slug)
      .filter((slug): slug is string => Boolean(slug)),
    releaseYear: releaseYear(row.films.release_date),
  }));

  const diaryInput: StatsDiaryEntryRow[] = (
    (diaryRows ?? []) as { is_rewatch: boolean }[]
  ).map((row) => ({ isRewatch: row.is_rewatch }));

  return computeFilmStats(statsInput, diaryInput);
}

export type MyUserFilm = {
  status: UserFilmStatus;
  rating: number | null;
  liked: boolean | null;
};

/** Bir film sayfasında "senin puanın" gibi tek-satır durumu göstermek için. */
export async function getMyUserFilm(
  db: SupabaseClient,
  filmId: string,
): Promise<MyUserFilm | null> {
  const { data, error } = await db
    .from("user_films")
    .select("status, rating, liked")
    .eq("film_id", filmId)
    .maybeSingle();
  if (error) throw new Error(`getMyUserFilm failed: ${error.message}`);
  return data as MyUserFilm | null;
}
