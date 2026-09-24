import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createFilmDataProvider } from "../_shared/tmdb/index.ts";
import { upsertFilm, upsertGenres } from "../_shared/tmdb/upsert.ts";

/**
 * PRD 10.2: `tmdb-lookup` — istemci `search_films` RPC'sinde yeterli sonuç
 * bulamazsa (yeni/az bilinen bir film) çağrılır. Canlı TMDB araması yapıp ilk
 * eşleşmeyi kataloğa ekler ve sonucu döner.
 */
export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    const { query } = (await req.json()) as { query?: string };
    if (!query || query.trim().length === 0) {
      return Response.json({ message: "query gerekli" }, { status: 400 });
    }

    const provider = createFilmDataProvider();
    const results = await provider.searchByTitle(query, 1);
    const top = results.results.filter((r) => !r.adult).slice(0, 3);

    if (top.length === 0) {
      return Response.json({ films: [] });
    }

    const genres = await provider.getGenres();
    const genreIdByTmdbId = await upsertGenres(ctx.supabaseAdmin, genres);

    const films = [];
    for (const item of top) {
      const details = await provider.getFilmDetails(item.id);
      const result = await upsertFilm(
        ctx.supabaseAdmin,
        details,
        genreIdByTmdbId,
      );
      if (!result.skipped) {
        films.push({
          filmId: result.filmId,
          tmdbId: item.id,
          title: item.title,
        });
      }
    }

    return Response.json({ films });
  }),
};

/* Yerelde çağırmak için:

  curl -i --request POST 'http://127.0.0.1:55321/functions/v1/tmdb-lookup' \
    --header 'apikey: <status çıktısındaki Secret anahtar>' \
    --header 'Content-Type: application/json' \
    --data '{"query":"Aşk Zamanı"}'

*/
