/** PRD bölüm 7 — Eşleşme ve sıralama algoritması. Tüm fonksiyonlar saf. */

export type TasteProfile = {
  userId: string;
  topFour: string[];
  liked: Set<string>;
  disliked: Set<string>;
  ratings: Map<string, number>;
  watched: Set<string>;
  watchlist: Set<string>;
  /** Anahtar: tür/on yıl/ülke kodu; değer: puan ağırlıklı, L2 normalize. */
  genreVector: Map<string, number>;
  decadeVector: Map<string, number>;
  countryVector: Map<string, number>;
  directorWeights: Map<string, number>;
};

const COMPONENT_WEIGHTS = {
  favOverlap: 0.3,
  ratingAgreement: 0.25,
  genreSim: 0.15,
  directorSim: 0.1,
  watchlistOverlap: 0.1,
  eraCountrySim: 0.05,
} as const;

const TOTAL_WEIGHT = Object.values(COMPONENT_WEIGHTS).reduce(
  (s, w) => s + w,
  0,
);
const MAX_CONFLICT_PENALTY = 0.15;
const CONFLICT_PENALTY_PER_FILM = 0.05;
const MIN_COMMON_RATINGS = 5;

/** PRD 7.2: az izlenen filmi paylaşmak daha güçlü bir sinyaldir. */
export function computeIdf(
  watchedCounts: Map<string, number>,
  activeUserCount: number,
): Map<string, number> {
  const n = Math.max(activeUserCount, 1);
  const idf = new Map<string, number>();
  for (const [filmId, count] of watchedCounts) {
    idf.set(filmId, Math.log(1 + n / (1 + count)));
  }
  return idf;
}

function idfWeight(idf: Map<string, number>, filmId: string): number {
  return idf.get(filmId) ?? Math.log(2);
}

function weightedCosineOverSets(
  setA: ReadonlySet<string>,
  setB: ReadonlySet<string>,
  idf: Map<string, number>,
): number | null {
  if (setA.size === 0 && setB.size === 0) return null;
  const union = new Set([...setA, ...setB]);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const filmId of union) {
    const w = idfWeight(idf, filmId);
    const a = setA.has(filmId) ? w : 0;
    const b = setB.has(filmId) ? w : 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return null;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function cosineOverVectors(
  a: Map<string, number>,
  b: Map<string, number>,
): number | null {
  const keys = new Set([...a.keys(), ...b.keys()]);
  if (keys.size === 0) return null;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const k of keys) {
    const va = a.get(k) ?? 0;
    const vb = b.get(k) ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return null;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** PRD 7.3 `ratingAgreement`: Pearson r + küçültme (`n<5` yok sayılır). */
function ratingAgreement(a: TasteProfile, b: TasteProfile): number | null {
  const common: [number, number][] = [];
  for (const [filmId, ra] of a.ratings) {
    const rb = b.ratings.get(filmId);
    if (rb !== undefined) common.push([ra, rb]);
  }
  const n = common.length;
  if (n < MIN_COMMON_RATINGS) return null;

  const meanA = common.reduce((s, [x]) => s + x, 0) / n;
  const meanB = common.reduce((s, [, y]) => s + y, 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (const [x, y] of common) {
    cov += (x - meanA) * (y - meanB);
    varA += (x - meanA) ** 2;
    varB += (y - meanB) ** 2;
  }
  if (varA === 0 || varB === 0) return null;
  const r = cov / Math.sqrt(varA * varB);
  const shrunk = r * (n / (n + 10));
  return (shrunk + 1) / 2;
}

/** PRD 7.3 `directorSim`: yönetmen ağırlıklı Jaccard. */
function directorJaccard(
  a: Map<string, number>,
  b: Map<string, number>,
): number | null {
  const keys = new Set([...a.keys(), ...b.keys()]);
  if (keys.size === 0) return null;
  let minSum = 0;
  let maxSum = 0;
  for (const k of keys) {
    const va = a.get(k) ?? 0;
    const vb = b.get(k) ?? 0;
    minSum += Math.min(va, vb);
    maxSum += Math.max(va, vb);
  }
  if (maxSum === 0) return null;
  return minSum / maxSum;
}

/** PRD 7.3 `watchlistOverlap`: IDF ağırlıklı kesişim / küçük küme boyutu, 1'de kırpılır. */
function watchlistOverlap(
  a: TasteProfile,
  b: TasteProfile,
  idf: Map<string, number>,
): number | null {
  if (a.watchlist.size === 0 || b.watchlist.size === 0) return null;
  let weightedIntersection = 0;
  for (const filmId of a.watchlist) {
    if (b.watchlist.has(filmId)) weightedIntersection += idfWeight(idf, filmId);
  }
  const minSize = Math.min(a.watchlist.size, b.watchlist.size);
  return Math.min(1, weightedIntersection / minSize);
}

/** PRD 7.3 `conflictPenalty`: A'nın favorisi B'nin "sevmedim"iyse (ve tersi). */
function conflictPenalty(
  a: TasteProfile,
  b: TasteProfile,
): { penalty: number; conflicts: string[] } {
  const conflicts: string[] = [];
  for (const filmId of a.topFour) {
    if (b.disliked.has(filmId)) conflicts.push(filmId);
  }
  for (const filmId of b.topFour) {
    if (a.disliked.has(filmId)) conflicts.push(filmId);
  }
  return {
    penalty: Math.min(
      MAX_CONFLICT_PENALTY,
      conflicts.length * CONFLICT_PENALTY_PER_FILM,
    ),
    conflicts,
  };
}

export type CompatibilityReason =
  | { type: "shared_favorite"; filmId: string }
  | { type: "shared_director"; personId: string }
  | { type: "rating_agreement" }
  | { type: "shared_watchlist" };

export type CompatibilityResult = {
  raw: number;
  components: Partial<Record<keyof typeof COMPONENT_WEIGHTS, number>>;
  reasons: CompatibilityReason[];
};

/** PRD 7.1-7.3: iki kullanıcı arası ham uyum skoru (0..1) + sebepler. */
export function computeCompatibility(
  a: TasteProfile,
  b: TasteProfile,
  idf: Map<string, number>,
): CompatibilityResult {
  const favA = new Set([...a.topFour, ...a.liked]);
  const favB = new Set([...b.topFour, ...b.liked]);

  const scores: Partial<Record<keyof typeof COMPONENT_WEIGHTS, number>> = {};

  const favOverlap = weightedCosineOverSets(favA, favB, idf);
  if (favOverlap !== null) scores.favOverlap = favOverlap;

  const rating = ratingAgreement(a, b);
  if (rating !== null) scores.ratingAgreement = rating;

  const genreSim = cosineOverVectors(a.genreVector, b.genreVector);
  if (genreSim !== null) scores.genreSim = genreSim;

  const directorSim = directorJaccard(a.directorWeights, b.directorWeights);
  if (directorSim !== null) scores.directorSim = directorSim;

  const watchlist = watchlistOverlap(a, b, idf);
  if (watchlist !== null) scores.watchlistOverlap = watchlist;

  const decadeSim = cosineOverVectors(a.decadeVector, b.decadeVector);
  const countrySim = cosineOverVectors(a.countryVector, b.countryVector);
  if (decadeSim !== null || countrySim !== null) {
    const parts = [decadeSim, countrySim].filter(
      (v): v is number => v !== null,
    );
    scores.eraCountrySim = parts.reduce((s, v) => s + v, 0) / parts.length;
  }

  // PRD 7.3'ün literal ifadesi ("yalnızca hesaplanabilen bileşenler üzerinden
  // yeniden normalize") tek bir bileşenin mükemmel eşleştiği ama diğer
  // bileşenlerin hiç hesaplanamadığı seyrek profillerde ham skoru yapay olarak
  // 1'e yakın şişirebiliyor — bu da "aynı profil = maksimum" kabul kriterini
  // (property-based test ile yakalandı) bozuyor. Eksik bileşenler, ağırlığını
  // korurken nötr (0.5) bir değerle katkıda bulunur; bu, kendisiyle
  // karşılaştırmanın (her hesaplanabilir bileşende her zaman en yüksek/eşit
  // değeri alması garanti olduğu için) hiçbir zaman aşılamamasını sağlar.
  const NEUTRAL_SCORE = 0.5;
  let weightedSum = 0;
  for (const key of Object.keys(
    COMPONENT_WEIGHTS,
  ) as (keyof typeof COMPONENT_WEIGHTS)[]) {
    const s = scores[key] ?? NEUTRAL_SCORE;
    weightedSum += COMPONENT_WEIGHTS[key] * s;
  }
  const rawBeforePenalty = weightedSum / TOTAL_WEIGHT;

  const { penalty } = conflictPenalty(a, b);
  const raw = Math.min(1, Math.max(0, rawBeforePenalty - penalty));

  const reasons: CompatibilityReason[] = [];
  const sharedFavorites = a.topFour.filter(
    (f) => b.topFour.includes(f) || b.liked.has(f),
  );
  for (const filmId of sharedFavorites.slice(0, 2)) {
    reasons.push({ type: "shared_favorite", filmId });
  }
  if (reasons.length < 3 && (scores.ratingAgreement ?? 0) > 0.7) {
    reasons.push({ type: "rating_agreement" });
  }
  if (reasons.length < 3 && (scores.watchlistOverlap ?? 0) > 0.3) {
    reasons.push({ type: "shared_watchlist" });
  }
  if (reasons.length < 3) {
    for (const [personId, weightA] of a.directorWeights) {
      if (reasons.length >= 3) break;
      if (weightA > 0 && (b.directorWeights.get(personId) ?? 0) > 0) {
        reasons.push({ type: "shared_director", personId });
      }
    }
  }

  return { raw, components: scores, reasons: reasons.slice(0, 3) };
}

/**
 * PRD 7.4: kalibrasyon — ham skoru, aday havuzundaki yüzdelik dilime göre
 * 50-99 aralığına eşler. `get_discovery_deck` SQL RPC'sindeki
 * `percent_rank()` ifadesiyle davranışça eşdeğer tutulmalı (bkz. ADR-0009).
 */
export function calibrateScore(raw: number, pool: readonly number[]): number {
  if (pool.length === 0) return 50;
  const below = pool.filter((v) => v < raw).length;
  const pctile = below / pool.length;
  return Math.round(Math.min(99, Math.max(50, 50 + pctile * 49)));
}
