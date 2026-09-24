import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompatibilityReason } from "@reelmate/core/domain/taste";
import { trackEvent } from "@reelmate/core/domain/analytics";

export type DistanceBucket = "<1" | "1-5" | "5-10" | "10-25" | "25+";

export type DiscoveryTopFourFilm = {
  filmId: string;
  posterPath: string | null;
};

export type DiscoveryCandidate = {
  userId: string;
  displayName: string | null;
  age: number | null;
  city: string | null;
  intents: string[];
  photoUrl: string | null;
  topFourFilms: DiscoveryTopFourFilm[] | null;
  distanceBucket: DistanceBucket;
  compatPercent: number;
  reasons: CompatibilityReason[];
};

type DiscoveryDeckRow = {
  user_id: string;
  display_name: string | null;
  age: number | null;
  city: string | null;
  intents: string[];
  photo_path: string | null;
  top_four_film_ids: string[] | null;
  distance_bucket: DistanceBucket;
  compat_percent: number;
  reasons: CompatibilityReason[];
};

const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * `profile-photos` bucket'ı private — `photo_path` yalnızca Storage yolu,
 * TMDB göreli yolu değil. Bu yüzden `tmdbImageUrl` ile birleştirilemez;
 * gösterim için gerçek bir imzalı URL üretilmesi gerekir.
 */
async function signPhotoPaths(
  db: SupabaseClient,
  paths: (string | null)[],
): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths.filter((p): p is string => !!p))];
  const map = new Map<string, string>();
  if (uniquePaths.length === 0) return map;
  const { data, error } = await db.storage
    .from("profile-photos")
    .createSignedUrls(uniquePaths, PHOTO_SIGNED_URL_TTL_SECONDS);
  if (error || !data) return map;
  for (const item of data) {
    if (item.signedUrl && !item.error && item.path)
      map.set(item.path, item.signedUrl);
  }
  return map;
}

async function fetchPosterPaths(
  db: SupabaseClient,
  filmIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (filmIds.length === 0) return map;
  const { data, error } = await db
    .from("films")
    .select("id, poster_path")
    .in("id", filmIds);
  if (error || !data) return map;
  for (const film of data as { id: string; poster_path: string | null }[]) {
    map.set(film.id, film.poster_path);
  }
  return map;
}

export async function getDiscoveryDeck(
  db: SupabaseClient,
  cursor = 0,
  limit = 20,
): Promise<DiscoveryCandidate[]> {
  const { data, error } = await db.rpc("get_discovery_deck", {
    p_cursor: cursor,
    p_limit: limit,
  });
  if (error) throw new Error(`getDiscoveryDeck failed: ${error.message}`);
  const rows = (data ?? []) as DiscoveryDeckRow[];

  const [photoUrls, posterPaths] = await Promise.all([
    signPhotoPaths(
      db,
      rows.map((row) => row.photo_path),
    ),
    fetchPosterPaths(db, [
      ...new Set(rows.flatMap((row) => row.top_four_film_ids ?? [])),
    ]),
  ]);

  return rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    age: row.age,
    city: row.city,
    intents: row.intents,
    photoUrl: row.photo_path ? (photoUrls.get(row.photo_path) ?? null) : null,
    topFourFilms:
      row.top_four_film_ids?.map((filmId) => ({
        filmId,
        posterPath: posterPaths.get(filmId) ?? null,
      })) ?? null,
    distanceBucket: row.distance_bucket,
    compatPercent: row.compat_percent,
    reasons: row.reasons,
  }));
}

export type SwipeAction = "like" | "pass" | "superlike";

export type SwipeResult = {
  matched: boolean;
  matchId: string | null;
};

function compatBucketFor(compatPercent: number | undefined): string {
  if (compatPercent === undefined) return "unknown";
  const lower = Math.floor(compatPercent / 10) * 10;
  return `${lower}-${lower + 9}`;
}

export async function swipe(
  db: SupabaseClient,
  targetId: string,
  action: SwipeAction,
  compatPercent?: number,
  reasonsCount = 0,
): Promise<SwipeResult> {
  const { data, error } = await db.rpc("swipe", {
    p_target_id: targetId,
    p_action: action,
  });
  if (error) throw error;
  const result = data as { matched: boolean; match_id: string | null };
  const compatBucket = compatBucketFor(compatPercent);
  trackEvent("swipe", { action, compatBucket });
  if (result.matched) {
    trackEvent("match_created", { compatBucket, reasonsCount });
  }
  return { matched: result.matched, matchId: result.match_id };
}

export async function undoLastSwipe(db: SupabaseClient): Promise<void> {
  const { error } = await db.rpc("undo_last_swipe");
  if (error) throw error;
}

export type LikeReceived = {
  userId: string;
  displayName: string | null;
  photoUrl: string | null;
  action: SwipeAction;
  createdAt: string;
};

export type LikesReceivedResult = {
  totalCount: number;
  likers: LikeReceived[] | null;
};

type LikerRow = {
  user_id: string;
  display_name: string | null;
  photo_path: string | null;
  action: SwipeAction;
  created_at: string;
};

export async function getLikesReceived(
  db: SupabaseClient,
): Promise<LikesReceivedResult> {
  const { data, error } = await db.rpc("get_likes_received");
  if (error) throw new Error(`getLikesReceived failed: ${error.message}`);
  const result = data as { total_count: number; likers: LikerRow[] | null };
  const photoUrls = await signPhotoPaths(
    db,
    (result.likers ?? []).map((row) => row.photo_path),
  );
  return {
    totalCount: result.total_count,
    likers:
      result.likers?.map((row) => ({
        userId: row.user_id,
        displayName: row.display_name,
        photoUrl: row.photo_path
          ? (photoUrls.get(row.photo_path) ?? null)
          : null,
        action: row.action,
        createdAt: row.created_at,
      })) ?? null,
  };
}

export async function blockUser(
  db: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await db.rpc("block_user", { p_user_id: userId });
  if (error) throw new Error(`blockUser failed: ${error.message}`);
  trackEvent("user_blocked", {});
}

export type ReportReason =
  | "fake_profile"
  | "underage"
  | "harassment"
  | "hate"
  | "sexual_content"
  | "spam"
  | "scam"
  | "spoiler_abuse"
  | "other";

export async function reportContent(
  db: SupabaseClient,
  targetType: string,
  targetId: string,
  reason: ReportReason,
  details?: string,
): Promise<void> {
  const { error } = await db.rpc("report_content", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_details: details ?? null,
  });
  if (error) throw new Error(`reportContent failed: ${error.message}`);
  trackEvent("report_submitted", { targetType, reason });
}
