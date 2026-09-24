import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { TasteProfile } from "../../../../packages/core/src/domain/taste.ts";

type UserFilmRow = {
  film_id: string;
  status: string;
  rating: number | null;
  liked: boolean | null;
  top_four_position: number | null;
  films: {
    release_date: string | null;
    countries: string[] | null;
    film_genres: { genres: { slug: string } | null }[];
    film_credits: { role: string; people: { id: string } | null }[];
  } | null;
};

const DEFAULT_WEIGHT = 1;

/** PRD 7.1: DB'den okuyup saf `TasteProfile` üretir (sorgu burada, hesap `packages/core`'da). */
export async function buildTasteProfile(
  db: SupabaseClient,
  userId: string,
): Promise<TasteProfile> {
  const { data, error } = await db
    .from("user_films")
    .select(
      `film_id, status, rating, liked, top_four_position,
       films(release_date, countries, film_genres(genres(slug)), film_credits(role, people(id)))`,
    )
    .eq("user_id", userId);
  if (error) throw new Error(`buildTasteProfile failed: ${error.message}`);

  const rows = (data ?? []) as unknown as UserFilmRow[];

  const topFour: string[] = [];
  const liked = new Set<string>();
  const disliked = new Set<string>();
  const ratings = new Map<string, number>();
  const watched = new Set<string>();
  const watchlist = new Set<string>();
  const genreVector = new Map<string, number>();
  const decadeVector = new Map<string, number>();
  const countryVector = new Map<string, number>();
  const directorWeights = new Map<string, number>();

  for (const row of rows) {
    if (row.top_four_position !== null)
      topFour[row.top_four_position - 1] = row.film_id;
    if (row.liked === true) liked.add(row.film_id);
    if (row.liked === false) disliked.add(row.film_id);
    if (row.rating !== null) ratings.set(row.film_id, row.rating);
    if (row.status === "watched") watched.add(row.film_id);
    if (row.status === "watchlist") watchlist.add(row.film_id);

    const weight = row.rating ?? DEFAULT_WEIGHT;
    const isSignal = row.status === "watched" || liked.has(row.film_id);
    if (!isSignal || !row.films) continue;

    for (const fg of row.films.film_genres) {
      const slug = fg.genres?.slug;
      if (!slug) continue;
      genreVector.set(slug, (genreVector.get(slug) ?? 0) + weight);
    }

    if (row.films.release_date) {
      const decade = String(
        Math.floor(new Date(row.films.release_date).getUTCFullYear() / 10) * 10,
      );
      decadeVector.set(decade, (decadeVector.get(decade) ?? 0) + weight);
    }

    for (const country of row.films.countries ?? []) {
      countryVector.set(country, (countryVector.get(country) ?? 0) + weight);
    }

    for (const credit of row.films.film_credits) {
      if (credit.role !== "director" || !credit.people) continue;
      directorWeights.set(
        credit.people.id,
        (directorWeights.get(credit.people.id) ?? 0) + weight,
      );
    }
  }

  return {
    userId,
    topFour: topFour.filter((f): f is string => Boolean(f)),
    liked,
    disliked,
    ratings,
    watched,
    watchlist,
    genreVector,
    decadeVector,
    countryVector,
    directorWeights,
  };
}
