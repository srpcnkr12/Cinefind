import type { CompatibilityReason } from "./taste";

/**
 * PRD 12.2 (v1, şablon tabanlı): eşleşme sebeplerinden öneri türü seçer.
 * Metin üretimi (film/kişi adıyla doldurma) çağıran tarafta i18n şablonlarıyla
 * yapılır — bu saf fonksiyon yalnızca hangi öneri türlerinin gösterileceğine
 * ve sırasına karar verir.
 */
export type IcebreakerSuggestion =
  | { kind: "shared_favorite"; filmId: string }
  | { kind: "shared_director"; personId: string }
  | { kind: "rating_agreement" }
  | { kind: "shared_watchlist" };

const DEFAULT_MAX_SUGGESTIONS = 3;

export function generateIcebreakers(
  reasons: readonly CompatibilityReason[],
  maxCount = DEFAULT_MAX_SUGGESTIONS,
): IcebreakerSuggestion[] {
  const suggestions: IcebreakerSuggestion[] = [];
  const seenFilmIds = new Set<string>();
  const seenPersonIds = new Set<string>();

  for (const reason of reasons) {
    if (suggestions.length >= maxCount) break;

    if (reason.type === "shared_favorite" && !seenFilmIds.has(reason.filmId)) {
      seenFilmIds.add(reason.filmId);
      suggestions.push({ kind: "shared_favorite", filmId: reason.filmId });
    } else if (
      reason.type === "shared_director" &&
      !seenPersonIds.has(reason.personId)
    ) {
      seenPersonIds.add(reason.personId);
      suggestions.push({ kind: "shared_director", personId: reason.personId });
    } else if (reason.type === "rating_agreement") {
      suggestions.push({ kind: "rating_agreement" });
    } else if (reason.type === "shared_watchlist") {
      suggestions.push({ kind: "shared_watchlist" });
    }
  }

  return suggestions;
}
