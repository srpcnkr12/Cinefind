// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createFilmDataProvider } from "../_shared/tmdb/index.ts";
import {
  seedCollections,
  upsertFilm,
  upsertGenres,
} from "../_shared/tmdb/upsert.ts";
import type { RawMovieListItem } from "../_shared/tmdb/types.ts";

const DEFAULT_MAX_PAGES = 3;
/** Bu süre içinde senkronlanmış filmin detayı yeniden çekilmez. */
const DEFAULT_TTL_DAYS = 7;

/**
 * PRD 10.2: `tmdb-sync` — popular/top_rated/now_playing(TR)/discover(tr) listelerini
 * sayfalar, her yeni/eskimiş filmin detayını+credits+translations'ını çeker ve
 * upsert eder. Fixture modunda ayrıca başlangıç koleksiyonlarını da kurar
 * (bkz. Faz 1 planı — gerçek TMDB modunda koleksiyonlar editoryaldir).
 *
 * `tmdb_synced_at` TTL'i içindeki filmlerin detayı YENİDEN ÇEKİLMEZ. Bu yalnızca
 * bir optimizasyon değil, işin tamamlanabilmesinin şartı: gerçek TMDB modunda
 * ~200 adayın detayını her çalıştırmada baştan çekmek edge runtime'ın kaynak
 * limitini (WORKER_LIMIT) aşıyor ve iş hiç bitmiyordu. TTL sayesinde her
 * çalıştırma kaldığı yerden ilerliyor ve günlük cron ucuz kalıyor.
 */
export default {
  fetch: withSupabase({ auth: "secret" }, async (_req, ctx) => {
    const provider = createFilmDataProvider();
    const maxPages = Number(
      Deno.env.get("TMDB_SYNC_MAX_PAGES") ?? DEFAULT_MAX_PAGES,
    );

    const genres = await provider.getGenres();
    const genreIdByTmdbId = await upsertGenres(ctx.supabaseAdmin, genres);

    const seen = new Map<number, RawMovieListItem>();
    async function collect(
      fetchPage: (
        page: number,
      ) => Promise<{ results: RawMovieListItem[]; total_pages: number }>,
    ) {
      for (let page = 1; page <= maxPages; page += 1) {
        const list = await fetchPage(page);
        for (const item of list.results) {
          if (!item.adult) seen.set(item.id, item);
        }
        if (page >= list.total_pages) break;
      }
    }

    await collect((page) => provider.listPopular(page));
    await collect((page) => provider.listTopRated(page));
    await collect((page) => provider.listNowPlaying(page, "TR"));
    await collect((page) => provider.discoverByOriginalLanguage("tr", page));

    const ttlDays = Number(
      Deno.env.get("TMDB_SYNC_TTL_DAYS") ?? DEFAULT_TTL_DAYS,
    );
    const staleBefore = new Date(
      Date.now() - ttlDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Adayların hâlihazırda taze olanlarını tek sorguda öğren; bunların
    // detayına hiç gidilmez. Harita ayrıca koleksiyon tohumlaması için
    // doldurulur, aksi halde atlanan filmler koleksiyonlardan düşerdi.
    const candidateIds = [...seen.keys()];
    const { data: existingRows, error: existingError } = await ctx.supabaseAdmin
      .from("films")
      .select("id, tmdb_id, tmdb_synced_at")
      .in("tmdb_id", candidateIds);
    if (existingError) {
      return Response.json({ error: existingError.message }, { status: 500 });
    }

    const filmIdByTmdbId = new Map<number, string>();
    const freshTmdbIds = new Set<number>();
    for (const row of existingRows ?? []) {
      filmIdByTmdbId.set(row.tmdb_id, row.id);
      if (row.tmdb_synced_at !== null && row.tmdb_synced_at > staleBefore) {
        freshTmdbIds.add(row.tmdb_id);
      }
    }

    let filmsUpserted = 0;
    let filmsSkippedFresh = 0;
    for (const item of seen.values()) {
      if (freshTmdbIds.has(item.id)) {
        filmsSkippedFresh += 1;
        continue;
      }
      const details = await provider.getFilmDetails(item.id);
      const result = await upsertFilm(
        ctx.supabaseAdmin,
        details,
        genreIdByTmdbId,
      );
      if (!result.skipped) {
        filmIdByTmdbId.set(item.id, result.filmId);
        filmsUpserted += 1;
      }
    }

    let collectionsSeeded = 0;
    if (provider.name === "fixture") {
      const collections = await provider.getSeedCollections();
      collectionsSeeded = await seedCollections(
        ctx.supabaseAdmin,
        collections,
        filmIdByTmdbId,
      );
    }

    // Katalog değiştiyse kural tabanlı koleksiyonları tazele (PRD 6.5).
    // Yoksa yeni filmler koleksiyonlara hiç girmez ve /explore eskir.
    let collectionLinks: number | null = null;
    if (filmsUpserted > 0) {
      const { data: refreshed, error: refreshError } =
        await ctx.supabaseAdmin.rpc("refresh_curated_collections");
      if (refreshError) {
        return Response.json({ error: refreshError.message }, { status: 500 });
      }
      collectionLinks = refreshed;
    }

    // Katalog değiştiyse web'in ISR sayfalarını tazele (PRD 10.2 revalidate-web).
    // Yapılandırılmamışsa (web henüz dağıtılmadı) sessizce atlanır.
    let revalidated = false;
    if (filmsUpserted > 0) {
      const target = Deno.env.get("WEB_REVALIDATE_URL");
      const secret = Deno.env.get("REVALIDATE_SECRET");
      if (target && secret) {
        try {
          const res = await fetch(target, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-revalidate-secret": secret,
            },
            body: JSON.stringify({ entity: "catalog" }),
          });
          revalidated = res.ok;
        } catch {
          // Senkronun kendisi başarılı; tazeleme hatası işi düşürmemeli.
          revalidated = false;
        }
      }
    }

    return Response.json({
      provider: provider.name,
      candidatesScanned: seen.size,
      filmsUpserted,
      filmsSkippedFresh,
      collectionsSeeded,
      collectionLinks,
      revalidated,
    });
  }),
};

/* Yerelde çağırmak için:

  1. `supabase start` (bkz. supabase.com/docs/reference/cli/supabase-start)
  2. `supabase functions serve`
  3. curl -i --request POST 'http://127.0.0.1:55321/functions/v1/tmdb-sync' \
       --header 'apikey: <status çıktısındaki Secret anahtar>'

*/
