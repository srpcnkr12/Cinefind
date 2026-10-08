import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@movieholix/core/domain/film";

export type FilmListItem = {
  id: string;
  slug: string;
  title: string;
  originalTitle: string;
  releaseYear: number | null;
  posterPath: string | null;
};

export type FilmGenre = { id: string; slug: string; name: string };
export type FilmPerson = {
  id: string;
  slug: string;
  name: string;
  character: string | null;
};

export type FilmDetail = FilmListItem & {
  tagline: string | null;
  overview: string | null;
  runtime: number | null;
  countries: string[];
  originalLanguage: string;
  backdropPath: string | null;
  releaseDate: string | null;
  genres: FilmGenre[];
  directors: FilmPerson[];
  cast: FilmPerson[];
};

export type PersonDetail = {
  id: string;
  slug: string;
  name: string;
  profilePath: string | null;
  knownForDepartment: string | null;
  filmography: (FilmListItem & { role: string })[];
};

export type CollectionListItem = {
  id: string;
  slug: string;
  title: string;
  intro: string | null;
  kind: "curated" | "genre" | "mood";
};

export type CollectionDetail = CollectionListItem & {
  films: FilmListItem[];
};

function releaseYear(date: string | null): number | null {
  return date ? new Date(date).getUTCFullYear() : null;
}

function pickTranslation<T extends { locale: string }>(
  rows: T[] | null | undefined,
  locale: Locale,
): T | undefined {
  return (
    rows?.find((r) => r.locale === locale) ??
    rows?.find((r) => r.locale === "en") ??
    rows?.[0]
  );
}

type FilmRow = {
  id: string;
  slug: string;
  original_title: string;
  original_language: string;
  release_date: string | null;
  runtime: number | null;
  countries: string[];
  poster_path: string | null;
  backdrop_path: string | null;
  film_translations: {
    locale: string;
    title: string;
    tagline: string | null;
    overview_source: string | null;
  }[];
  film_genres: {
    genres: {
      id: string;
      slug: string;
      genre_translations: { locale: string; name: string }[];
    };
  }[];
  film_credits: {
    role: string;
    character: string | null;
    people: { id: string; slug: string; name: string };
  }[];
};

const FILM_DETAIL_SELECT = `
  id, slug, original_title, original_language, release_date, runtime, countries, poster_path, backdrop_path,
  film_translations(locale, title, tagline, overview_source),
  film_genres(genres(id, slug, genre_translations(locale, name))),
  film_credits(role, character, people(id, slug, name))
`;

function mapFilmRow(row: FilmRow, locale: Locale): FilmDetail {
  const translation = pickTranslation(row.film_translations, locale);
  const genres: FilmGenre[] = row.film_genres.map(({ genres: g }) => {
    const t = pickTranslation(g.genre_translations, locale);
    return { id: g.id, slug: g.slug, name: t?.name ?? g.slug };
  });
  const directors: FilmPerson[] = row.film_credits
    .filter((c) => c.role === "director")
    .map((c) => ({
      id: c.people.id,
      slug: c.people.slug,
      name: c.people.name,
      character: null,
    }));
  const cast: FilmPerson[] = row.film_credits
    .filter((c) => c.role === "cast")
    .map((c) => ({
      id: c.people.id,
      slug: c.people.slug,
      name: c.people.name,
      character: c.character,
    }));

  return {
    id: row.id,
    slug: row.slug,
    title: translation?.title ?? row.original_title,
    originalTitle: row.original_title,
    originalLanguage: row.original_language,
    releaseYear: releaseYear(row.release_date),
    releaseDate: row.release_date,
    runtime: row.runtime,
    countries: row.countries,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    tagline: translation?.tagline ?? null,
    overview: translation?.overview_source ?? null,
    genres,
    directors,
    cast,
  };
}

export async function getFilmBySlug(
  db: SupabaseClient,
  slug: string,
  locale: Locale,
): Promise<FilmDetail | null> {
  const { data, error } = await db
    .from("films")
    .select(FILM_DETAIL_SELECT)
    .eq("slug", slug)
    .maybeSingle<FilmRow>();
  if (error) throw new Error(`getFilmBySlug failed: ${error.message}`);
  if (!data) return null;
  return mapFilmRow(data, locale);
}

const FILM_LIST_SELECT = `
  id, slug, original_title, release_date, poster_path,
  film_translations(locale, title)
`;

type FilmListRow = {
  id: string;
  slug: string;
  original_title: string;
  release_date: string | null;
  poster_path: string | null;
  film_translations: { locale: string; title: string }[];
};

function mapFilmListRow(row: FilmListRow, locale: Locale): FilmListItem {
  const translation = pickTranslation(row.film_translations, locale);
  return {
    id: row.id,
    slug: row.slug,
    title: translation?.title ?? row.original_title,
    originalTitle: row.original_title,
    releaseYear: releaseYear(row.release_date),
    posterPath: row.poster_path,
  };
}

const PAGE_SIZE = 24;

export async function listFilms(
  db: SupabaseClient,
  locale: Locale,
  page = 1,
): Promise<{ items: FilmListItem[]; total: number }> {
  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await db
    .from("films")
    .select(FILM_LIST_SELECT, { count: "exact" })
    .not("tmdb_synced_at", "is", null)
    .order("tmdb_popularity", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(`listFilms failed: ${error.message}`);
  return {
    items: ((data ?? []) as FilmListRow[]).map((row) =>
      mapFilmListRow(row, locale),
    ),
    total: count ?? 0,
  };
}

export async function listPopularFilms(
  db: SupabaseClient,
  locale: Locale,
  limit = 20,
): Promise<FilmListItem[]> {
  const { data, error } = await db
    .from("films")
    .select(FILM_LIST_SELECT)
    .not("tmdb_synced_at", "is", null)
    .order("tmdb_popularity", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listPopularFilms failed: ${error.message}`);
  return ((data ?? []) as FilmListRow[]).map((row) =>
    mapFilmListRow(row, locale),
  );
}

/** Aynı türden en az bir ortak, bu film hariç, popülerliğe göre sıralı. */
export async function listSimilarFilms(
  db: SupabaseClient,
  film: Pick<FilmDetail, "id" | "genres">,
  locale: Locale,
  limit = 6,
): Promise<FilmListItem[]> {
  if (film.genres.length === 0) return [];
  const { data, error } = await db
    .from("films")
    .select(`${FILM_LIST_SELECT}, film_genres!inner(genre_id)`)
    .in(
      "film_genres.genre_id",
      film.genres.map((g) => g.id),
    )
    .neq("id", film.id)
    .not("tmdb_synced_at", "is", null)
    .order("tmdb_popularity", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listSimilarFilms failed: ${error.message}`);
  return ((data ?? []) as FilmListRow[]).map((row) =>
    mapFilmListRow(row, locale),
  );
}

export async function listFilmsByPerson(
  db: SupabaseClient,
  personId: string,
  role: "director" | "cast",
  locale: Locale,
  excludeFilmId?: string,
  limit = 6,
): Promise<FilmListItem[]> {
  const { data, error } = await db
    .from("films")
    .select(`${FILM_LIST_SELECT}, film_credits!inner(person_id, role)`)
    .eq("film_credits.person_id", personId)
    .eq("film_credits.role", role)
    .not("tmdb_synced_at", "is", null)
    .order("tmdb_popularity", { ascending: false })
    .limit(limit + 1);
  if (error) throw new Error(`listFilmsByPerson failed: ${error.message}`);
  return ((data ?? []) as FilmListRow[])
    .filter((row) => row.id !== excludeFilmId)
    .slice(0, limit)
    .map((row) => mapFilmListRow(row, locale));
}

export async function getPersonBySlug(
  db: SupabaseClient,
  slug: string,
  locale: Locale,
): Promise<PersonDetail | null> {
  const { data: person, error } = await db
    .from("people")
    .select("id, slug, name, profile_path, known_for_department")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getPersonBySlug failed: ${error.message}`);
  if (!person) return null;

  const [directed, acted] = await Promise.all([
    listFilmsByPerson(db, person.id, "director", locale, undefined, 20),
    listFilmsByPerson(db, person.id, "cast", locale, undefined, 20),
  ]);

  return {
    id: person.id,
    slug: person.slug,
    name: person.name,
    profilePath: person.profile_path,
    knownForDepartment: person.known_for_department,
    filmography: [
      ...directed.map((f) => ({ ...f, role: "director" })),
      ...acted.map((f) => ({ ...f, role: "cast" })),
    ],
  };
}

type CollectionRow = {
  id: string;
  slug: string;
  kind: "curated" | "genre" | "mood";
  collection_translations: {
    locale: string;
    title: string;
    intro: string | null;
  }[];
};

export async function listCollections(
  db: SupabaseClient,
  locale: Locale,
): Promise<CollectionListItem[]> {
  const { data, error } = await db
    .from("collections")
    .select("id, slug, kind, collection_translations(locale, title, intro)")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`listCollections failed: ${error.message}`);
  return ((data ?? []) as CollectionRow[]).map((row) => {
    const t = pickTranslation(row.collection_translations, locale);
    return {
      id: row.id,
      slug: row.slug,
      kind: row.kind,
      title: t?.title ?? row.slug,
      intro: t?.intro ?? null,
    };
  });
}

export async function getCollectionBySlug(
  db: SupabaseClient,
  slug: string,
  locale: Locale,
): Promise<CollectionDetail | null> {
  const { data: collection, error } = await db
    .from("collections")
    .select("id, slug, kind, collection_translations(locale, title, intro)")
    .eq("slug", slug)
    .maybeSingle<CollectionRow>();
  if (error) throw new Error(`getCollectionBySlug failed: ${error.message}`);
  if (!collection) return null;

  const { data: filmRows, error: filmsError } = await db
    .from("collection_films")
    .select(`position, films(${FILM_LIST_SELECT})`)
    .eq("collection_id", collection.id)
    .order("position", { ascending: true });
  if (filmsError)
    throw new Error(`getCollectionBySlug films failed: ${filmsError.message}`);

  const t = pickTranslation(collection.collection_translations, locale);
  return {
    id: collection.id,
    slug: collection.slug,
    kind: collection.kind,
    title: t?.title ?? collection.slug,
    intro: t?.intro ?? null,
    films: ((filmRows ?? []) as unknown as { films: FilmListRow }[]).map(
      (row) => mapFilmListRow(row.films, locale),
    ),
  };
}

export type SearchFilmResult = {
  filmId: string;
  slug: string;
  title: string;
  originalTitle: string;
  releaseYear: number | null;
  posterPath: string | null;
};

export async function searchFilms(
  db: SupabaseClient,
  query: string,
  limit = 20,
): Promise<SearchFilmResult[]> {
  const { data, error } = await db.rpc("search_films", {
    query,
    result_limit: limit,
  });
  if (error) throw new Error(`searchFilms failed: ${error.message}`);
  return (data ?? []).map(
    (row: {
      film_id: string;
      slug: string;
      title: string;
      original_title: string;
      release_year: number | null;
      poster_path: string | null;
    }) => ({
      filmId: row.film_id,
      slug: row.slug,
      title: row.title,
      originalTitle: row.original_title,
      releaseYear: row.release_year,
      posterPath: row.poster_path,
    }),
  );
}

export type CommunityPost = {
  id: string;
  type: string;
  body: string | null;
  rating: number | null;
  containsSpoiler: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
};

export type CommunityLine = {
  id: string;
  text: string;
  characterName: string | null;
  containsSpoiler: boolean;
};

export type FilmCommunity = {
  posts: CommunityPost[];
  lines: CommunityLine[];
  averageRating: number | null;
  ratingCount: number;
};

/**
 * Web'in film sayfasındaki "Toplulukta" bölümü için — yalnızca herkese açık
 * verileri (`public_web_posts` view'ı + genel görünür replikler) okur.
 */
export async function getFilmCommunity(
  db: SupabaseClient,
  filmId: string,
): Promise<FilmCommunity> {
  const [
    { data: posts, error: postsError },
    { data: lines, error: linesError },
    { data: stats },
  ] = await Promise.all([
    db
      .from("public_web_posts")
      .select(
        "id, type, body, rating, contains_spoiler, like_count, comment_count, created_at, username, display_name",
      )
      .eq("film_id", filmId)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("film_lines")
      .select("id, text, character_name, contains_spoiler")
      .eq("film_id", filmId)
      .eq("contains_spoiler", false)
      .limit(20),
    db
      .from("film_stats")
      .select("avg_rating, rating_count")
      .eq("film_id", filmId)
      .maybeSingle(),
  ]);
  if (postsError)
    throw new Error(`getFilmCommunity failed: ${postsError.message}`);
  if (linesError)
    throw new Error(`getFilmCommunity failed: ${linesError.message}`);

  return {
    posts: (
      (posts ?? []) as {
        id: string;
        type: string;
        body: string | null;
        rating: number | null;
        contains_spoiler: boolean;
        like_count: number;
        comment_count: number;
        created_at: string;
        username: string | null;
        display_name: string | null;
      }[]
    ).map((row) => ({
      id: row.id,
      type: row.type,
      body: row.body,
      rating: row.rating,
      containsSpoiler: row.contains_spoiler,
      likeCount: row.like_count,
      commentCount: row.comment_count,
      createdAt: row.created_at,
      authorUsername: row.username,
      authorDisplayName: row.display_name,
    })),
    lines: (
      (lines ?? []) as {
        id: string;
        text: string;
        character_name: string | null;
        contains_spoiler: boolean;
      }[]
    ).map((row) => ({
      id: row.id,
      text: row.text,
      characterName: row.character_name,
      containsSpoiler: row.contains_spoiler,
    })),
    averageRating:
      (stats as { avg_rating: number | null } | null)?.avg_rating ?? null,
    ratingCount: (stats as { rating_count: number } | null)?.rating_count ?? 0,
  };
}

/**
 * Verilen id'ler için film listesi öğelerini döndürür (ortak izleme listesi gibi
 * yalnızca film id'si tutan yüzeyler için). Sıra korunmaz — çağıran taraf kendi
 * sırasını uygulamalı.
 */
export async function listFilmsByIds(
  db: SupabaseClient,
  locale: Locale,
  ids: readonly string[],
): Promise<FilmListItem[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db
    .from("films")
    .select(FILM_LIST_SELECT)
    .in("id", ids as string[]);
  if (error) throw new Error(`listFilmsByIds failed: ${error.message}`);
  return ((data ?? []) as unknown as FilmListRow[]).map((row) =>
    mapFilmListRow(row, locale),
  );
}
