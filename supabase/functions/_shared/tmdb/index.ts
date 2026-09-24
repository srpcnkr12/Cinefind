import type { FilmDataProvider } from "./provider.ts";
import { TmdbProvider } from "./tmdb-provider.ts";
import { FixtureProvider } from "./fixture-provider.ts";

/**
 * `FILM_DATA_PROVIDER` env'ini okur. `tmdb` seçili olsa bile geçerli bir
 * `TMDB_API_READ_ACCESS_TOKEN` yoksa otomatik olarak fixture'a düşer
 * (PRD 11.1: "TMDB geliştirici anahtarı yoksa ... fixture ile çalışmalı").
 */
export function createFilmDataProvider(): FilmDataProvider {
  const mode = Deno.env.get("FILM_DATA_PROVIDER") ?? "fixture";
  const token = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN");

  if (mode === "tmdb" && token) {
    return new TmdbProvider(token);
  }
  return new FixtureProvider();
}

export type { FilmDataProvider };
