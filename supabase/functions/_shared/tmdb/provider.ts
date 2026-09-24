import type {
  FixtureCollection,
  MovieList,
  RawGenre,
  RawMovieDetails,
} from "./types.ts";

/**
 * Film verisi soyutlaması (PRD 11.2 — "Veri erişimi FilmDataProvider arayüzü
 * arkasında soyutlanmalı"). `tmdb-provider.ts` (gerçek TMDB) ve
 * `fixture-provider.ts` (anahtar yokken yerel geliştirme) bu arayüzü uygular.
 */
export interface FilmDataProvider {
  readonly name: "tmdb" | "fixture";
  getGenres(): Promise<RawGenre[]>;
  listPopular(page: number): Promise<MovieList>;
  listTopRated(page: number): Promise<MovieList>;
  listNowPlaying(page: number, region: string): Promise<MovieList>;
  discoverByOriginalLanguage(
    language: string,
    page: number,
  ): Promise<MovieList>;
  getFilmDetails(tmdbId: number): Promise<RawMovieDetails>;
  searchByTitle(query: string, page: number): Promise<MovieList>;
  /** Yalnızca fixture sağlayıcısında dolu döner; TMDB sağlayıcısında boş dizi. */
  getSeedCollections(): Promise<FixtureCollection[]>;
}
