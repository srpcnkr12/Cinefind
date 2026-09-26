import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { computeCompatibility } from "../../../packages/core/src/domain/taste.ts";
import { buildTasteProfile } from "../_shared/taste/build-profile.ts";

/** Bir cron çalıştırmasında kuyruktan alınacak kullanıcı sayısı. */
const QUEUE_BATCH = 20;
/** Bir kullanıcı için skorlanacak azami aday sayısı (O(n²) büyümesini sınırlar). */
const CANDIDATE_LIMIT = 100;

/**
 * PRD 10.2 `compute-compat`: bölüm 7'nin uyum algoritmasını çalıştırır.
 *
 * İki mod:
 *  - `{ userId, candidateIds }` — belirli çiftleri skorlar (elle/hedefli).
 *  - `{ mode: "queue" }` — `compat_recompute_queue`'dan bir parti kullanıcı alır,
 *    her biri için uygun adayları bulup skorlar. Cron bu modu çağırır.
 *
 * Kuyruk modu olmadan hattın tüketen ucu yoktu: kuyruk doluyor ama hiçbir şey
 * boşaltmıyordu, dolayısıyla `compatibility_scores` boş kalıyor ve keşfet
 * destesi herkes için nötr 0.5'e düşüyordu.
 */
export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as {
      userId?: string;
      candidateIds?: string[];
      mode?: string;
    };

    let jobs: { userId: string; candidateIds: string[] }[];

    if (body.mode === "queue") {
      const { data: claimed, error: claimError } = await ctx.supabaseAdmin.rpc(
        "claim_compat_queue",
        { p_limit: QUEUE_BATCH },
      );
      if (claimError) {
        return Response.json({ error: claimError.message }, { status: 500 });
      }
      jobs = [];
      for (const row of (claimed ?? []) as { user_id: string }[]) {
        const { data: candidates, error: candidateError } =
          await ctx.supabaseAdmin.rpc("get_compat_candidates", {
            p_user_id: row.user_id,
            p_limit: CANDIDATE_LIMIT,
          });
        if (candidateError) {
          return Response.json(
            { error: candidateError.message },
            { status: 500 },
          );
        }
        const ids = ((candidates ?? []) as { candidate_id: string }[]).map(
          (c) => c.candidate_id,
        );
        if (ids.length > 0)
          jobs.push({ userId: row.user_id, candidateIds: ids });
      }
      if (jobs.length === 0) {
        return Response.json({ scored: 0, users: 0 });
      }
    } else if (
      body.userId &&
      body.candidateIds &&
      body.candidateIds.length > 0
    ) {
      jobs = [{ userId: body.userId, candidateIds: body.candidateIds }];
    } else {
      return Response.json(
        { error: 'userId ve candidateIds zorunlu (ya da mode:"queue")' },
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
    // Bir parti içinde aynı kişi hem kuyruktan hem başkasının adayı olarak
    // gelebiliyor; profil kurulumu en pahalı adım olduğu için önbellekleniyor.
    const profileCache = new Map<
      string,
      Awaited<ReturnType<typeof buildTasteProfile>>
    >();
    async function profileFor(id: string) {
      const cached = profileCache.get(id);
      if (cached) return cached;
      const built = await buildTasteProfile(ctx.supabaseAdmin, id);
      profileCache.set(id, built);
      return built;
    }

    const results: { userId: string; candidateId: string; raw: number }[] = [];
    for (const job of jobs) {
      const userProfile = await profileFor(job.userId);
      for (const candidateId of job.candidateIds) {
        const candidateProfile = await profileFor(candidateId);
        const { raw, components, reasons } = computeCompatibility(
          userProfile,
          candidateProfile,
          idf,
        );

        const userLow = job.userId < candidateId ? job.userId : candidateId;
        const userHigh = job.userId < candidateId ? candidateId : job.userId;

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
        results.push({ userId: job.userId, candidateId, raw });
      }
    }

    return Response.json({ scored: results.length, users: jobs.length });
  }),
};
