import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@movieholix/core/domain/film";
import { signPhotoPaths } from "./discovery";

/** Profil sekmesinin tek çağrıda ihtiyaç duyduğu özet (PRD 3.1 "Kadrajım" dahil). */
export type MyProfileSummary = {
  displayName: string | null;
  username: string | null;
  age: number | null;
  city: string | null;
  bio: string | null;
  photoUrl: string | null;
  kadrajim: { filmId: string; title: string; posterPath: string | null }[];
};

type ProfileRow = {
  display_name: string | null;
  username: string | null;
  birthdate: string | null;
  city: string | null;
  bio: string | null;
};

type TopFourRow = {
  film_id: string;
  top_four_position: number | null;
  films: {
    poster_path: string | null;
    original_title: string;
    film_translations: { locale: string; title: string }[];
  } | null;
};

function ageFromBirthdate(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const born = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate()))
    age -= 1;
  return age;
}

export async function getMyProfileSummary(
  db: SupabaseClient,
  locale: Locale,
): Promise<MyProfileSummary | null> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await db
    .from("profiles")
    .select("display_name, username, birthdate, city, bio")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`getMyProfileSummary failed: ${error.message}`);
  if (!profile) return null;

  const { data: photo } = await db
    .from("profile_photos")
    .select("storage_path")
    .eq("user_id", user.id)
    .order("position")
    .limit(1)
    .maybeSingle();

  const signed = photo
    ? await signPhotoPaths(db, [photo.storage_path])
    : new Map<string, string>();

  const { data: topFour } = await db
    .from("user_films")
    .select(
      "film_id, top_four_position, films(poster_path, original_title, film_translations(locale, title))",
    )
    .not("top_four_position", "is", null)
    .order("top_four_position");

  const row = profile as ProfileRow;
  return {
    displayName: row.display_name,
    username: row.username,
    age: ageFromBirthdate(row.birthdate),
    city: row.city,
    bio: row.bio,
    photoUrl: photo ? (signed.get(photo.storage_path) ?? null) : null,
    kadrajim: ((topFour ?? []) as unknown as TopFourRow[]).map((entry) => ({
      filmId: entry.film_id,
      title:
        entry.films?.film_translations.find((t) => t.locale === locale)
          ?.title ??
        entry.films?.original_title ??
        "",
      posterPath: entry.films?.poster_path ?? null,
    })),
  };
}
