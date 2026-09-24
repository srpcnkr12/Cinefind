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

/**
 * PRD 10.2: `tmdb-sync` — popular/top_rated/now_playing(TR)/discover(tr) listelerini
 * sayfalar, her yeni/eskimiş filmin detayını+credits+translations'ını çeker ve
 * upsert eder. Fixture modunda ayrıca başlangıç koleksiyonlarını da kurar
 * (bkz. Faz 1 planı — gerçek TMDB modunda koleksiyonlar editoryaldir).
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

    let filmsUpserted = 0;
    const filmIdByTmdbId = new Map<number, string>();
    for (const item of seen.values()) {
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

    return Response.json({
      provider: provider.name,
      candidatesScanned: seen.size,
      filmsUpserted,
      collectionsSeeded,
    });
  }),
};

/* Yerelde çağırmak için:

  1. `supabase start` (bkz. supabase.com/docs/reference/cli/supabase-start)
  2. `supabase functions serve`
  3. curl -i --request POST 'http://127.0.0.1:55321/functions/v1/tmdb-sync' \
       --header 'apikey: <status çıktısındaki Secret anahtar>'

*/
