import { palette, surfaces } from "./raw.cjs";

export { palette, surfaces };

export type ThemeName = "light" | "dark";

export type SemanticColors = {
  background: string;
  foreground: string;
  surface1: string;
  surface2: string;
  primary: string;
  onPrimary: string;
  like: string;
  onLike: string;
  accent: string;
  onAccent: string;
  /**
   * Yalnızca `background` üzerinde kullanılır (bkz. PRD 15.2).
   * `surface1`/`surface2` üzerinde AA-large eşiğini bile geçmiyor —
   * kart/yüzey içinde ikincil metin için `foreground` kullan.
   *
   * UYARI (Faz 2'de Lighthouse'ta gerçek bir ihlal olarak yakalandı): "AA-large"
   * eşiği (3:1) yalnızca WCAG'ın kesin "büyük metin" tanımını (≥24px normal ya da
   * ≥18.66px kalın) karşılayan metinlerde geçerlidir. Web'deki gövde/başlık metni
   * neredeyse hiçbir zaman bu boyuta ulaşmadığından, pratikte `secondaryText`i
   * normal ağırlıklı gövde/altyazı metninde KULLANMA — bunun yerine `foreground`
   * kullan. `secondaryText` yalnızca gerçekten büyük/kalın metin ya da metin
   * olmayan öğeler (kenarlık, ikon) için güvenlidir.
   */
  secondaryText: string;
  danger: string;
  onDanger: string;
  success: string;
  onSuccess: string;
};

function buildTheme(name: ThemeName): SemanticColors {
  const isLight = name === "light";
  return {
    background: isLight ? palette.screen : palette.ink,
    foreground: isLight ? palette.ink : palette.screen,
    surface1: isLight ? surfaces.light.surface1 : surfaces.dark.surface1,
    surface2: isLight ? surfaces.light.surface2 : surfaces.dark.surface2,
    primary: palette.reel,
    onPrimary: "#FFFFFF",
    like: palette.ticket,
    onLike: palette.ink,
    accent: palette.popcorn,
    onAccent: palette.ink,
    secondaryText: palette.celluloid,
    danger: palette.danger,
    onDanger: "#FFFFFF",
    success: palette.success,
    onSuccess: "#FFFFFF",
  };
}

export const theme: Record<ThemeName, SemanticColors> = {
  light: buildTheme("light"),
  dark: buildTheme("dark"),
};

export type ContrastLevel = "AA" | "AA-large";

export type ContrastPair = {
  name: string;
  fg: string;
  bg: string;
  level: ContrastLevel;
};

/**
 * Tasarım sisteminde fiilen kullanılan metin/zemin çiftleri.
 * `packages/tokens/src/contrast.test.ts` bunları WCAG karşısında doğrular.
 * Buradaki dışında bir metin/zemin kombinasyonu (ör. secondaryText on surface1)
 * kasıtlı olarak sanksiyonlanmamıştır — bkz. `SemanticColors.secondaryText` notu.
 */
export function buildContrastPairs(): ContrastPair[] {
  const pairs: ContrastPair[] = [];
  for (const name of ["light", "dark"] as const) {
    const t = theme[name];
    pairs.push(
      {
        name: `${name}: foreground/background`,
        fg: t.foreground,
        bg: t.background,
        level: "AA",
      },
      {
        name: `${name}: foreground/surface1`,
        fg: t.foreground,
        bg: t.surface1,
        level: "AA",
      },
      {
        name: `${name}: foreground/surface2`,
        fg: t.foreground,
        bg: t.surface2,
        level: "AA",
      },
      {
        name: `${name}: onPrimary/primary`,
        fg: t.onPrimary,
        bg: t.primary,
        level: "AA",
      },
      { name: `${name}: onLike/like`, fg: t.onLike, bg: t.like, level: "AA" },
      {
        name: `${name}: onAccent/accent`,
        fg: t.onAccent,
        bg: t.accent,
        level: "AA",
      },
      {
        name: `${name}: onDanger/danger`,
        fg: t.onDanger,
        bg: t.danger,
        level: "AA",
      },
      {
        name: `${name}: onSuccess/success`,
        fg: t.onSuccess,
        bg: t.success,
        level: "AA",
      },
      {
        name: `${name}: secondaryText/background`,
        fg: t.secondaryText,
        bg: t.background,
        level: "AA-large",
      },
    );
  }
  return pairs;
}
