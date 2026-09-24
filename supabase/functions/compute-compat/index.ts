import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { computeCompatibility } from "../../../packages/core/src/domain/taste.ts";
import { buildTasteProfile } from "../_shared/taste/build-profile.ts";

/**
 * PRD 10.2 `compute-compat`: bölüm 7'nin uyum algoritmasını çalıştırır.
 * Girdi: `{ userId, candidateIds }`. `get_discovery_deck` önbellekte skoru
 * olmayan adaylar için bunu tetikler (bkz. plan gerekçe #6, ADR-0009).
 */
export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    const { userId, candidateIds } = (await req.json()) as {
      userId?: string;
      candidateIds?: string[];
    };
    if (!userId || !candidateIds || candidateIds.length === 0) {
      return Response.json(
        { error: "userId ve candidateIds zorunlu" },
        { status: 400 },
      );
    }

    await ctx.supabaseAdmin.rpc("refresh_film_idf");

    const { data: statsRows, error: statsError } = await ctx.supabaseAdmin
      .from("film_stats")
      .select("film_id, idf");
    if (statsError) {
      return Response.json({ error: statsError.message }, { status: 500 });
    }
    const idf = new Map<string, number>();
    for (const row of statsRows ?? []) {
      if (row.idf !== null) idf.set(row.film_id, row.idf as number);
    }
    const userProfile = await buildTasteProfile(ctx.supabaseAdmin, userId);

    const results: { candidateId: string; raw: number }[] = [];
    for (const candidateId of candidateIds) {
      const candidateProfile = await buildTasteProfile(
        ctx.supabaseAdmin,
        candidateId,
      );
      const { raw, components, reasons } = computeCompatibility(
        userProfile,
        candidateProfile,
        idf,
      );

      const userLow = userId < candidateId ? userId : candidateId;
      const userHigh = userId < candidateId ? candidateId : userId;

      const { error: upsertError } = await ctx.supabaseAdmin
        .from("compatibility_scores")
        .upsert(
          {
            user_low: userLow,
            user_high: userHigh,
            raw_score: raw,
            components,
            reasons,
            computed_at: new Date().toISOString(),
          },
          { onConflict: "user_low,user_high" },
        );
      if (upsertError) {
        return Response.json({ error: upsertError.message }, { status: 500 });
      }
      results.push({ candidateId, raw });
    }

    return Response.json({ scored: results.length, results });
  }),
};
