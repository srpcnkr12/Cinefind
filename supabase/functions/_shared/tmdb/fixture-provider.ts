import type { FilmDataProvider } from "./provider.ts";
import type {
  FixtureCollection,
  MovieList,
  RawGenre,
  RawMovieDetails,
  RawMovieListItem,
} from "./types.ts";
import fixtureData from "../../../seed/films.fixture.json" with { type: "json" };

type FixtureFilm = {
  id: number;
  title: string;
  original_title: string;
  original_language: string;
  release_date: string;
  runtime: number;
  countries: string[];
  adult: boolean;
  popularity: number;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids: number[];
  translations: Record<
    "tr" | "en",
    { title: string; tagline: string; overview: string }
  >;
  credits: {
    crew: { tmdb_id: number; name: string; job: string; department: string }[];
    cast: { tmdb_id: number; name: string; character: string; order: number }[];
  };
};

type Fixture = {
  genres: { id: number; name_en: string; name_tr: string }[];
  films: FixtureFilm[];
  collections: {
    slug: string;
    kind: "curated" | "genre" | "mood";
    translations: Record<"tr" | "en", { title: string; intro: string }>;
    filmTmdbIds: number[];
  }[];
};

const fixture = fixtureData as Fixture;

function toListItem(film: FixtureFilm): RawMovieListItem {
  return {
    id: film.id,
    title: film.translations.en.title,
    original_title: film.original_title,
    original_language: film.original_language,
    release_date: film.release_date,
    adult: film.adult,
    popularity: film.popularity,
    poster_path: film.poster_path,
    backdrop_path: film.backdrop_path,
    genre_ids: film.genre_ids,
  };
}

function toList(films: FixtureFilm[], page: number): MovieList {
  // Fixture'da gerçek TMDB sayfalaması yok: tüm sonuçlar 1. sayfada, sonrası boş.
  return {
    results: page === 1 ? films.map(toListItem) : [],
    page,
    total_pages: 1,
  };
}

export class FixtureProvider implements FilmDataProvider {
  readonly name = "fixture" as const;

  async getGenres(): Promise<RawGenre[]> {
    return fixture.genres.map((g) => ({
      id: g.id,
      name: g.name_en,
      name_tr: g.name_tr,
    }));
  }

  async listPopular(page: number): Promise<MovieList> {
    return toList(fixture.films, page);
  }

  async listTopRated(page: number): Promise<MovieList> {
    return toList(fixture.films, page);
  }

  async listNowPlaying(page: number, _region: string): Promise<MovieList> {
    return toList(fixture.films, page);
  }

  async discoverByOriginalLanguage(
    language: string,
    page: number,
  ): Promise<MovieList> {
    return toList(
      fixture.films.filter((f) => f.original_language === language),
      page,
    );
  }

  async getFilmDetails(tmdbId: number): Promise<RawMovieDetails> {
    const film = fixture.films.find((f) => f.id === tmdbId);
    if (!film) {
      throw new Error(`Fixture'da film bulunamadı: tmdb_id=${tmdbId}`);
    }
    return {
      ...toListItem(film),
      imdb_id: null,
      runtime: film.runtime,
      production_countries: film.countries.map((code) => ({
        iso_3166_1: code,
        name: code,
      })),
      genres: film.genre_ids.map((id) => {
        const g = fixture.genres.find((x) => x.id === id);
        return { id, name: g?.name_en ?? String(id) };
      }),
      credits: {
        cast: film.credits.cast.map((c) => ({
          id: c.tmdb_id,
          name: c.name,
          character: c.character,
          order: c.order,
          known_for_department: "Acting",
          profile_path: null,
        })),
        crew: film.credits.crew.map((c) => ({
          id: c.tmdb_id,
          name: c.name,
          job: c.job,
          department: c.department,
          known_for_department: c.department,
          profile_path: null,
        })),
      },
      translations: {
        translations: (["tr", "en"] as const).map((locale) => ({
          iso_639_1: locale,
          iso_3166_1: locale === "tr" ? "TR" : "US",
          data: {
            title: film.translations[locale].title,
            tagline: film.translations[locale].tagline,
            overview: film.translations[locale].overview,
          },
        })),
      },
    };
  }

  async searchByTitle(query: string, page: number): Promise<MovieList> {
    const needle = query.toLowerCase();
    const matches = fixture.films.filter(
      (f) =>
        f.original_title.toLowerCase().includes(needle) ||
        f.translations.tr.title.toLowerCase().includes(needle) ||
        f.translations.en.title.toLowerCase().includes(needle),
    );
    return toList(matches, page);
  }

  async getSeedCollections(): Promise<FixtureCollection[]> {
    return fixture.collections;
  }
}
