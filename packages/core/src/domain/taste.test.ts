import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  calibrateScore,
  computeCompatibility,
  computeIdf,
  type TasteProfile,
} from "./taste";

const FILM_IDS = ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8"];
const DIRECTOR_IDS = ["d1", "d2", "d3"];

function makeProfile(
  userId: string,
  overrides: Partial<TasteProfile> = {},
): TasteProfile {
  return {
    userId,
    topFour: [],
    liked: new Set(),
    disliked: new Set(),
    ratings: new Map(),
    watched: new Set(),
    watchlist: new Set(),
    genreVector: new Map(),
    decadeVector: new Map(),
    countryVector: new Map(),
    directorWeights: new Map(),
    ...overrides,
  };
}

const idf = computeIdf(new Map(FILM_IDS.map((f) => [f, 3])), 20);

/** Kendi içinde tutarlı (liked/disliked/topFour ayrık) rastgele bir TasteProfile üretir. */
const profileArbitrary = fc
  .record({
    filmSubset: fc.uniqueArray(fc.constantFrom(...FILM_IDS), {
      minLength: 0,
      maxLength: FILM_IDS.length,
    }),
    ratingSeed: fc.array(
      fc.tuple(fc.constantFrom(...FILM_IDS), fc.integer({ min: 1, max: 10 })),
      { maxLength: 8 },
    ),
    genreSeed: fc.array(
      fc.tuple(
        fc.constantFrom("drama", "comedy", "horror", "romance"),
        fc.integer({ min: 1, max: 10 }),
      ),
      {
        maxLength: 4,
      },
    ),
    directorSeed: fc.array(
      fc.tuple(
        fc.constantFrom(...DIRECTOR_IDS),
        fc.integer({ min: 1, max: 5 }),
      ),
      { maxLength: 3 },
    ),
  })
  .map(({ filmSubset, ratingSeed, genreSeed, directorSeed }): TasteProfile => {
    const half = Math.floor(filmSubset.length / 2);
    const topFour = filmSubset.slice(0, Math.min(4, half));
    const liked = new Set(filmSubset.slice(0, half));
    const disliked = new Set(
      filmSubset
        .slice(half)
        .filter((f) => !liked.has(f) && !topFour.includes(f)),
    );
    const ratings = new Map(ratingSeed.map(([f, r]) => [f, r / 2]));
    return makeProfile("p", {
      topFour,
      liked,
      disliked,
      ratings,
      watched: new Set([...liked, ...ratings.keys()]),
      watchlist: new Set(filmSubset.slice(0, Math.max(1, half - 1))),
      genreVector: new Map(genreSeed),
      directorWeights: new Map(directorSeed),
    });
  });

describe("computeCompatibility", () => {
  it("simetriktir: compat(a,b) === compat(b,a)", () => {
    fc.assert(
      fc.property(profileArbitrary, profileArbitrary, (a, b) => {
        const ab = computeCompatibility(a, b, idf).raw;
        const ba = computeCompatibility(b, a, idf).raw;
        expect(ab).toBeCloseTo(ba, 9);
      }),
      { numRuns: 200 },
    );
  });

  it("her zaman 0..1 aralığındadır", () => {
    fc.assert(
      fc.property(profileArbitrary, profileArbitrary, (a, b) => {
        const { raw } = computeCompatibility(a, b, idf);
        expect(raw).toBeGreaterThanOrEqual(0);
        expect(raw).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });

  it("aynı profille karşılaştırma, havuzdaki başka hiçbir profilden düşük değildir", () => {
    fc.assert(
      fc.property(
        profileArbitrary,
        fc.array(profileArbitrary, { minLength: 1, maxLength: 5 }),
        (a, others) => {
          const selfScore = computeCompatibility(a, a, idf).raw;
          for (const other of others) {
            const otherScore = computeCompatibility(a, other, idf).raw;
            expect(selfScore).toBeGreaterThanOrEqual(otherScore - 1e-9);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("bilinen bir örnekte beklenen bileşenleri üretir (regresyon)", () => {
    const a = makeProfile("a", {
      topFour: ["f1", "f2"],
      liked: new Set(["f1", "f2", "f3"]),
      ratings: new Map([
        ["f1", 5],
        ["f2", 4.5],
        ["f3", 4],
        ["f4", 2],
        ["f5", 1.5],
      ]),
      genreVector: new Map([["drama", 5]]),
    });
    const b = makeProfile("b", {
      topFour: ["f1"],
      liked: new Set(["f1", "f2"]),
      ratings: new Map([
        ["f1", 5],
        ["f2", 4],
        ["f3", 3.5],
        ["f4", 2.5],
        ["f5", 2],
      ]),
      genreVector: new Map([["drama", 4]]),
    });
    const result = computeCompatibility(a, b, idf);
    expect(result.components.favOverlap).toBeGreaterThan(0.5);
    expect(result.components.ratingAgreement).toBeGreaterThan(0.5);
    expect(result.raw).toBeGreaterThan(0.5);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("favori-sevmedim çakışmasında ceza uygular", () => {
    // bNoConflict ve bConflict, favOverlap'in ikisinde de aynı şekilde
    // hesaplanabilmesi için özdeş `liked` kümesine sahip — tek fark
    // bConflict'in a'nın favorisini (f1) "sevmedim" olarak işaretlemesi.
    const a = makeProfile("a", { topFour: ["f1"], liked: new Set(["f1"]) });
    const bNoConflict = makeProfile("b", { liked: new Set(["f2"]) });
    const bConflict = makeProfile("b2", {
      liked: new Set(["f2"]),
      disliked: new Set(["f1"]),
    });
    const withoutConflict = computeCompatibility(a, bNoConflict, idf).raw;
    const withConflict = computeCompatibility(a, bConflict, idf).raw;
    expect(withConflict).toBeLessThanOrEqual(withoutConflict);
  });
});

describe("calibrateScore", () => {
  it("her zaman 50..99 aralığındadır", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.array(fc.float({ min: 0, max: 1, noNaN: true }), {
          minLength: 1,
          maxLength: 50,
        }),
        (raw, pool) => {
          const score = calibrateScore(raw, pool);
          expect(score).toBeGreaterThanOrEqual(50);
          expect(score).toBeLessThanOrEqual(99);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("havuz boşsa 50 döner", () => {
    expect(calibrateScore(0.9, [])).toBe(50);
  });

  it("yüksek ham skor, düşük skordan daha yüksek veya eşit kalibre değer alır", () => {
    const pool = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    expect(calibrateScore(0.9, pool)).toBeGreaterThanOrEqual(
      calibrateScore(0.1, pool),
    );
  });
});
