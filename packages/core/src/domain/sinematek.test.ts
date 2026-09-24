import { describe, expect, it } from "vitest";
import {
  computeFilmStats,
  type StatsDiaryEntryRow,
  type StatsUserFilmRow,
} from "./sinematek";

describe("computeFilmStats", () => {
  const userFilms: StatsUserFilmRow[] = [
    {
      status: "watched",
      rating: 5,
      genreSlugs: ["drama", "romance"],
      releaseYear: 1994,
    },
    { status: "watched", rating: 4, genreSlugs: ["drama"], releaseYear: 1999 },
    {
      status: "watched",
      rating: null,
      genreSlugs: ["comedy"],
      releaseYear: 2001,
    },
    {
      status: "watchlist",
      rating: null,
      genreSlugs: ["horror"],
      releaseYear: 2010,
    },
    { status: "none", rating: null, genreSlugs: [], releaseYear: null },
  ];
  const diaryEntries: StatsDiaryEntryRow[] = [
    { isRewatch: false },
    { isRewatch: true },
    { isRewatch: true },
  ];

  it("izlenen ve izleme listesi sayılarını doğru ayırıyor", () => {
    const stats = computeFilmStats(userFilms, diaryEntries);
    expect(stats.totalWatched).toBe(3);
    expect(stats.totalWatchlist).toBe(1);
  });

  it("yalnızca puanlı filmlerin ortalamasını alıyor", () => {
    const stats = computeFilmStats(userFilms, diaryEntries);
    expect(stats.ratedCount).toBe(2);
    expect(stats.averageRating).toBeCloseTo(4.5);
  });

  it("puanlı film yoksa ortalama null dönüyor", () => {
    const stats = computeFilmStats(
      [{ status: "watched", rating: null, genreSlugs: [], releaseYear: null }],
      [],
    );
    expect(stats.averageRating).toBeNull();
  });

  it("en çok tekrar eden türü en üstte sıralıyor", () => {
    const stats = computeFilmStats(userFilms, diaryEntries);
    expect(stats.topGenres[0]).toEqual({ slug: "drama", count: 2 });
  });

  it("en çok izlenen on yılı buluyor", () => {
    const stats = computeFilmStats(userFilms, diaryEntries);
    expect(stats.topDecade).toBe(1990);
  });

  it("tekrar izleme sayısını günlükten hesaplıyor", () => {
    const stats = computeFilmStats(userFilms, diaryEntries);
    expect(stats.rewatchCount).toBe(2);
  });

  it("boş girdiyle çökmüyor", () => {
    const stats = computeFilmStats([], []);
    expect(stats).toEqual({
      totalWatched: 0,
      totalWatchlist: 0,
      ratedCount: 0,
      averageRating: null,
      rewatchCount: 0,
      topGenres: [],
      topDecade: null,
    });
  });
});
