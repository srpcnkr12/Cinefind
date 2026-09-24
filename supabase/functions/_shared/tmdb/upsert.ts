import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { FixtureCollection, RawGenre, RawMovieDetails } from "./types.ts";
import { slugify } from "./slugify.ts";

export type UpsertSummary = {
  filmsUpserted: number;
  peopleUpserted: number;
  genresUpserted: number;
  collectionsSeeded: number;
};

export async function upsertGenres(
  db: SupabaseClient,
  genres: RawGenre[],
): Promise<Map<number, string>> {
  const idByTmdbId = new Map<number, string>();
  for (const genre of genres) {
    const slug = slugify(genre.name);
    const { data, error } = await db
      .from("genres")
      .upsert({ tmdb_id: genre.id, slug }, { onConflict: "tmdb_id" })
      .select("id")
      .single();
    if (error)
      throw new Error(`genre upsert failed (${genre.name}): ${error.message}`);
    idByTmdbId.set(genre.id, data.id as string);
    await db
      .from("genre_translations")
      .upsert(
        { genre_id: data.id, locale: "en", name: genre.name },
        { onConflict: "genre_id,locale" },
      );
    if (genre.name_tr) {
      await db
        .from("genre_translations")
        .upsert(
          { genre_id: data.id, locale: "tr", name: genre.name_tr },
          { onConflict: "genre_id,locale" },
        );
    }
  }
  return idByTmdbId;
}

async function upsertPerson(
  db: SupabaseClient,
  tmdbId: number,
  name: string,
  department: string | null,
): Promise<string> {
  const { data, error } = await db
    .from("people")
    .upsert(
      {
        tmdb_id: tmdbId,
        name,
        slug: `${slugify(name)}-${Math.abs(tmdbId)}`,
        known_for_department: department,
      },
      { onConflict: "tmdb_id" },
    )
    .select("id")
    .single();
  if (error)
    throw new Error(`person upsert failed (${name}): ${error.message}`);
  return data.id as string;
}

/**
 * Bir filmin tam detayını (credits + translations dahil) idempotent şekilde yazar.
 * `adult=true` filmler baştan elenir (savunma amaçlı — discover zaten hariç tutuyor).
 */
export async function upsertFilm(
  db: SupabaseClient,
  details: RawMovieDetails,
  genreIdByTmdbId: Map<number, string>,
): Promise<{ skipped: true } | { skipped: false; filmId: string }> {
  if (details.adult) {
    return { skipped: true };
  }

  const slug = `${slugify(details.title || details.original_title)}-${Math.abs(details.id)}`;

  const { data: film, error: filmError } = await db
    .from("films")
    .upsert(
      {
        tmdb_id: details.id,
        imdb_id: details.imdb_id,
        original_title: details.original_title,
        original_language: details.original_language,
        release_date: details.release_date || null,
        runtime: details.runtime,
        countries: details.production_countries.map((c) => c.iso_3166_1),
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,
        tmdb_popularity: details.popularity,
        adult: details.adult,
        slug,
        tmdb_synced_at: new Date().toISOString(),
      },
      { onConflict: "tmdb_id" },
    )
    .select("id")
    .single();
  if (filmError)
    throw new Error(
      `film upsert failed (tmdb_id=${details.id}): ${filmError.message}`,
    );
  const filmId = film.id as string;

  for (const translation of details.translations.translations) {
    if (translation.iso_639_1 !== "tr" && translation.iso_639_1 !== "en")
      continue;
    if (!translation.data.title) continue;
    await db.from("film_translations").upsert(
      {
        film_id: filmId,
        locale: translation.iso_639_1,
        title: translation.data.title,
        tagline: translation.data.tagline || null,
        overview_source: translation.data.overview || null,
      },
      { onConflict: "film_id,locale" },
    );
  }
  // TMDB her zaman iki dilde çeviri döndürmeyebilir — orijinal başlığı en azından
  // İngilizce satırı yoksa yedek olarak kullan (arama RPC'si en/tr bekliyor).
  const hasEnglish = details.translations.translations.some(
    (t) => t.iso_639_1 === "en",
  );
  if (!hasEnglish) {
    await db.from("film_translations").upsert(
      {
        film_id: filmId,
        locale: "en",
        title: details.title || details.original_title,
      },
      { onConflict: "film_id,locale" },
    );
  }

  await db.from("film_genres").delete().eq("film_id", filmId);
  const genreRows = details.genres
    .map((g) => genreIdByTmdbId.get(g.id))
    .filter((id): id is string => Boolean(id))
    .map((genreId) => ({ film_id: filmId, genre_id: genreId }));
  if (genreRows.length > 0) {
    await db.from("film_genres").insert(genreRows);
  }

  await db.from("film_credits").delete().eq("film_id", filmId);
  const creditRows: {
    film_id: string;
    person_id: string;
    role: string;
    character: string | null;
    billing_order: number | null;
  }[] = [];
  for (const director of details.credits.crew.filter(
    (c) => c.job === "Director",
  )) {
    const personId = await upsertPerson(
      db,
      director.id,
      director.name,
      director.department,
    );
    creditRows.push({
      film_id: filmId,
      person_id: personId,
      role: "director",
      character: null,
      billing_order: null,
    });
  }
  for (const member of details.credits.cast.slice(0, 15)) {
    const personId = await upsertPerson(
      db,
      member.id,
      member.name,
      member.known_for_department,
    );
    creditRows.push({
      film_id: filmId,
      person_id: personId,
      role: "cast",
      character: member.character || null,
      billing_order: member.order,
    });
  }
  if (creditRows.length > 0) {
    await db.from("film_credits").insert(creditRows);
  }

  await db
    .from("film_stats")
    .upsert(
      { film_id: filmId },
      { onConflict: "film_id", ignoreDuplicates: true },
    );

  return { skipped: false, filmId };
}

/** Yalnızca fixture modunda çağrılır — gerçek TMDB modunda koleksiyonlar editoryaldir. */
export async function seedCollections(
  db: SupabaseClient,
  collections: FixtureCollection[],
  filmIdByTmdbId: Map<number, string>,
): Promise<number> {
  let seeded = 0;
  for (const [index, collection] of collections.entries()) {
    const { data: row, error } = await db
      .from("collections")
      .upsert(
        {
          slug: collection.slug,
          kind: collection.kind,
          is_published: true,
          sort_order: index,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (error)
      throw new Error(
        `collection upsert failed (${collection.slug}): ${error.message}`,
      );
    const collectionId = row.id as string;

    for (const locale of ["tr", "en"] as const) {
      const t = collection.translations[locale];
      await db.from("collection_translations").upsert(
        {
          collection_id: collectionId,
          locale,
          title: t.title,
          intro: t.intro,
        },
        { onConflict: "collection_id,locale" },
      );
    }

    await db
      .from("collection_films")
      .delete()
      .eq("collection_id", collectionId);
    const filmRows = collection.filmTmdbIds
      .map((tmdbId, position) => {
        const filmId = filmIdByTmdbId.get(tmdbId);
        return filmId
          ? { collection_id: collectionId, film_id: filmId, position }
          : null;
      })
      .filter(
        (
          row,
        ): row is {
          collection_id: string;
          film_id: string;
          position: number;
        } => row !== null,
      );
    if (filmRows.length > 0) {
      await db.from("collection_films").insert(filmRows);
    }
    seeded += 1;
  }
  return seeded;
}
