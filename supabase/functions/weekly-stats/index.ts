import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

/**
 * PRD 10.2 `weekly-stats`: pazartesi cron'u (bkz. Faz 8 migration'ındaki
 * `weekly_stats_monday` — Faz 1'in `tmdb_sync_daily` deseniyle aynı, yerelde
 * Vault secret'ı olmadığı için doğrudan HTTP çağrısıyla test edilir). Her
 * tamamlanmış onboarding'e sahip kullanıcıya `weekly_stats_ready` bildirimi
 * ekler; gerçek istatistik hesaplaması istemci `get_weekly_stats()`'ı
 * çağırdığında yapılır (bu fonksiyon yalnızca "hazır" sinyalini üretir).
 */
export default {
  fetch: withSupabase({ auth: "secret" }, async (_req, ctx) => {
    const { data: users, error } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("onboarding_step", "completed");
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const rows = (users ?? []).map((u: { id: string }) => ({
      user_id: u.id,
      type: "weekly_stats_ready",
      actor_id: null,
      entity: {},
    }));

    if (rows.length > 0) {
      const { error: insertError } = await ctx.supabaseAdmin
        .from("notifications")
        .insert(rows);
      if (insertError) {
        return Response.json({ error: insertError.message }, { status: 500 });
      }
    }

    return Response.json({ notified: rows.length });
  }),
};
