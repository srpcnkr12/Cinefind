import { describe, expect, it } from "vitest";
import { TMDB_IMAGE_BASE_URL, tmdbImageUrl } from "./film";

describe("tmdbImageUrl", () => {
  it("TMDB göreli yolunu boyutlu CDN URL'ine çevirir", () => {
    expect(tmdbImageUrl("/abc.jpg", "w500")).toBe(
      `${TMDB_IMAGE_BASE_URL}w500/abc.jpg`,
    );
  });

  it("yol yoksa null döner", () => {
    expect(tmdbImageUrl(null, "w500")).toBeNull();
  });

  it("mutlak URL'i olduğu gibi bırakır (TMDB dışı katalog kaynağı)", () => {
    const selfHosted =
      "http://127.0.0.1:55321/storage/v1/object/public/film-art/posters/x.png";
    expect(tmdbImageUrl(selfHosted, "w500")).toBe(selfHosted);
    expect(tmdbImageUrl("https://cdn.example.com/p.png", "w185")).toBe(
      "https://cdn.example.com/p.png",
    );
  });
});
