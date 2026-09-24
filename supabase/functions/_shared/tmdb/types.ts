/**
 * TMDB API v3'ten kullandığımız alanların dar tipleri (tam response şeması değil).
 * Doğrulama: docs.themoviedb.org/reference — bkz. Faz 1 planı.
 */

export type RawGenre = {
  id: number;
  name: string;
  /** Varsa Türkçe ad — yoksa `genre_translations`'a yalnızca `en` satırı yazılır. */
  name_tr?: string;
};

export type RawCastMember = {
  id: number;
  name: string;
  character: string;
  order: number;
  known_for_department: string | null;
  profile_path: string | null;
};

export type RawCrewMember = {
  id: number;
  name: string;
  job: string;
  department: string;
  known_for_department: string | null;
  profile_path: string | null;
};

export type RawCredits = {
  cast: RawCastMember[];
  crew: RawCrewMember[];
};

export type RawTranslationEntry = {
  iso_639_1: string;
  iso_3166_1: string;
  data: {
    title?: string;
    tagline?: string;
    overview?: string;
  };
};

export type RawTranslations = {
  translations: RawTranslationEntry[];
};

/** `/discover/movie`, `/movie/popular` vb. liste uçlarının tek bir öğesi. */
export type RawMovieListItem = {
  id: number;
  title: string;
  original_title: string;
  original_language: string;
  release_date: string | null;
  adult: boolean;
  popularity: number;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids: number[];
};

/** `/movie/{id}?append_to_response=credits,translations` tam yanıtı. */
export type RawMovieDetails = RawMovieListItem & {
  imdb_id: string | null;
  runtime: number | null;
  production_countries: { iso_3166_1: string; name: string }[];
  genres: RawGenre[];
  credits: RawCredits;
  translations: RawTranslations;
};

export type MovieList = {
  results: RawMovieListItem[];
  page: number;
  total_pages: number;
};

/** Fixture'a özgü ek alan: hangi koleksiyonlara ait olduğu (yalnızca fixture modunda kullanılır). */
export type FixtureCollection = {
  slug: string;
  kind: "curated" | "genre" | "mood";
  translations: Record<"tr" | "en", { title: string; intro: string }>;
  filmTmdbIds: number[];
};
