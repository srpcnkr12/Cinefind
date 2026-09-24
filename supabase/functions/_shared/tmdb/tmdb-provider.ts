import type { FilmDataProvider } from "./provider.ts";
import type {
  FixtureCollection,
  MovieList,
  RawGenre,
  RawMovieDetails,
} from "./types.ts";

const BASE_URL = "https://api.themoviedb.org/3";
/** TMDB rate limitini dokümante etmiyor; istekler arasında temkinli bir gecikme. */
const REQUEST_DELAY_MS = 250;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TmdbProvider implements FilmDataProvider {
  readonly name = "tmdb" as const;

  constructor(private readonly accessToken: string) {}

  private async fetchJson<T>(
    path: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        accept: "application/json",
      },
    });
    await delay(REQUEST_DELAY_MS);
    if (!response.ok) {
      throw new Error(`TMDB isteği başarısız: ${path} (${response.status})`);
    }
    return (await response.json()) as T;
  }

  async getGenres(): Promise<RawGenre[]> {
    const [en, tr] = await Promise.all([
      this.fetchJson<{ genres: RawGenre[] }>("/genre/movie/list", {
        language: "en-US",
      }),
      this.fetchJson<{ genres: RawGenre[] }>("/genre/movie/list", {
        language: "tr-TR",
      }),
    ]);
    const nameTrById = new Map(tr.genres.map((g) => [g.id, g.name]));
    return en.genres.map((g) => ({ ...g, name_tr: nameTrById.get(g.id) }));
  }

  listPopular(page: number): Promise<MovieList> {
    return this.fetchJson<MovieList>("/movie/popular", { page: String(page) });
  }

  listTopRated(page: number): Promise<MovieList> {
    return this.fetchJson<MovieList>("/movie/top_rated", {
      page: String(page),
    });
  }

  listNowPlaying(page: number, region: string): Promise<MovieList> {
    return this.fetchJson<MovieList>("/movie/now_playing", {
      page: String(page),
      region,
    });
  }

  discoverByOriginalLanguage(
    language: string,
    page: number,
  ): Promise<MovieList> {
    return this.fetchJson<MovieList>("/discover/movie", {
      with_original_language: language,
      include_adult: "false",
      sort_by: "popularity.desc",
      page: String(page),
    });
  }

  getFilmDetails(tmdbId: number): Promise<RawMovieDetails> {
    return this.fetchJson<RawMovieDetails>(`/movie/${tmdbId}`, {
      append_to_response: "credits,translations",
    });
  }

  searchByTitle(query: string, page: number): Promise<MovieList> {
    return this.fetchJson<MovieList>("/search/movie", {
      query,
      include_adult: "false",
      page: String(page),
    });
  }

  async getSeedCollections(): Promise<FixtureCollection[]> {
    return [];
  }
}
