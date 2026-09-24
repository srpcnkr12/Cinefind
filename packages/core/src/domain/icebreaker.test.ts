import { describe, expect, it } from "vitest";
import { generateIcebreakers } from "./icebreaker";
import type { CompatibilityReason } from "./taste";

describe("generateIcebreakers", () => {
  it("boş sebep listesinde boş öneri döner", () => {
    expect(generateIcebreakers([])).toEqual([]);
  });

  it("her sebep türünü doğru öneri türüne eşler", () => {
    const reasons: CompatibilityReason[] = [
      { type: "shared_favorite", filmId: "f1" },
      { type: "shared_director", personId: "p1" },
      { type: "rating_agreement" },
      { type: "shared_watchlist" },
    ];
    expect(generateIcebreakers(reasons, 10)).toEqual([
      { kind: "shared_favorite", filmId: "f1" },
      { kind: "shared_director", personId: "p1" },
      { kind: "rating_agreement" },
      { kind: "shared_watchlist" },
    ]);
  });

  it("maxCount'u aşmaz", () => {
    const reasons: CompatibilityReason[] = [
      { type: "shared_favorite", filmId: "f1" },
      { type: "shared_favorite", filmId: "f2" },
      { type: "rating_agreement" },
    ];
    expect(generateIcebreakers(reasons, 2)).toHaveLength(2);
  });

  it("aynı filmi/kişiyi tekrar önermez", () => {
    const reasons: CompatibilityReason[] = [
      { type: "shared_favorite", filmId: "f1" },
      { type: "shared_favorite", filmId: "f1" },
    ];
    expect(generateIcebreakers(reasons, 10)).toEqual([
      { kind: "shared_favorite", filmId: "f1" },
    ]);
  });
});
