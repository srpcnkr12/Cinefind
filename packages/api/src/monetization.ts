import type { SupabaseClient } from "@supabase/supabase-js";
import { trackEvent } from "@reelmate/core/domain/analytics";

export type Entitlement = {
  entitlement: "premium";
  expiresAt: string;
  store: string | null;
  productId: string | null;
};

type EntitlementRow = {
  entitlement: "premium";
  expires_at: string;
  store: string | null;
  product_id: string | null;
};

/** Kullanıcının kendi entitlement satırını okur (varsa) — paywall/rozet gösterimi için. */
export async function getMyEntitlement(
  db: SupabaseClient,
): Promise<Entitlement | null> {
  const { data, error } = await db
    .from("entitlements")
    .select("entitlement, expires_at, store, product_id")
    .eq("entitlement", "premium")
    .maybeSingle();
  if (error) throw new Error(`getMyEntitlement failed: ${error.message}`);
  if (!data) return null;
  const row = data as EntitlementRow;
  return {
    entitlement: row.entitlement,
    expiresAt: row.expires_at,
    store: row.store,
    productId: row.product_id,
  };
}

export type ConsumableBalances = {
  boosts: number;
  superMessages: number;
};

export async function getConsumableBalances(
  db: SupabaseClient,
): Promise<ConsumableBalances> {
  const { data, error } = await db
    .from("consumable_balances")
    .select("boosts, super_messages")
    .maybeSingle();
  if (error) throw new Error(`getConsumableBalances failed: ${error.message}`);
  return {
    boosts: data?.boosts ?? 0,
    superMessages: data?.super_messages ?? 0,
  };
}

export async function activateBoost(
  db: SupabaseClient,
): Promise<{ endsAt: string }> {
  const { data, error } = await db.rpc("use_boost");
  if (error) throw error;
  const result = data as { ends_at: string };
  trackEvent("boost_used", {});
  return { endsAt: result.ends_at };
}

export async function sendSuperMessage(
  db: SupabaseClient,
  recipientId: string,
  body: string,
): Promise<string> {
  const { data, error } = await db.rpc("send_super_message", {
    p_recipient_id: recipientId,
    p_body: body,
  });
  if (error) throw error;
  trackEvent("super_message_sent", {});
  return data as string;
}

export async function respondToSuperMessage(
  db: SupabaseClient,
  conversationId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await db.rpc("respond_to_super_message", {
    p_conversation_id: conversationId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function recordProfileView(
  db: SupabaseClient,
  viewedId: string,
): Promise<void> {
  const { error } = await db.rpc("record_profile_view", {
    p_viewed_id: viewedId,
  });
  if (error) throw new Error(`recordProfileView failed: ${error.message}`);
}

export type WeeklyStatsViewer = {
  userId: string;
  displayName: string | null;
  photoPath: string | null;
  viewedAt: string;
};

export type WeeklyStats = {
  profileViewsThisWeek: number;
  matchesThisWeek: number;
  topPost: { postId: string; likeCount: number; commentCount: number } | null;
  topMatchFilm: { filmId: string; title: string; matchCount: number } | null;
  viewers: WeeklyStatsViewer[] | null;
  regionalRank: number | null;
};

type WeeklyStatsResult = {
  profile_views_this_week: number;
  matches_this_week: number;
  top_post: {
    post_id: string;
    like_count: number;
    comment_count: number;
  } | null;
  top_match_film: {
    film_id: string;
    title: string;
    match_count: number;
  } | null;
  viewers:
    | {
        user_id: string;
        display_name: string | null;
        photo_path: string | null;
        viewed_at: string;
      }[]
    | null;
  regional_rank: number | null;
};

export async function getWeeklyStats(db: SupabaseClient): Promise<WeeklyStats> {
  const { data, error } = await db.rpc("get_weekly_stats");
  if (error) throw new Error(`getWeeklyStats failed: ${error.message}`);
  const result = data as WeeklyStatsResult;
  return {
    profileViewsThisWeek: result.profile_views_this_week,
    matchesThisWeek: result.matches_this_week,
    topPost: result.top_post
      ? {
          postId: result.top_post.post_id,
          likeCount: result.top_post.like_count,
          commentCount: result.top_post.comment_count,
        }
      : null,
    topMatchFilm: result.top_match_film
      ? {
          filmId: result.top_match_film.film_id,
          title: result.top_match_film.title,
          matchCount: result.top_match_film.match_count,
        }
      : null,
    viewers:
      result.viewers?.map((v) => ({
        userId: v.user_id,
        displayName: v.display_name,
        photoPath: v.photo_path,
        viewedAt: v.viewed_at,
      })) ?? null,
    regionalRank: result.regional_rank,
  };
}
