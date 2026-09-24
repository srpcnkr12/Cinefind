import { describe, expect, it } from "vitest";
import { buildContrastPairs } from "./colors";

// WCAG 2.x relative luminance / contrast ratio (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance)
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

const THRESHOLDS = { AA: 4.5, "AA-large": 3.0 } as const;

describe("design tokens — WCAG AA contrast", () => {
  for (const pair of buildContrastPairs()) {
    it(`${pair.name} passes ${pair.level} (>= ${THRESHOLDS[pair.level]}:1)`, () => {
      const ratio = contrastRatio(pair.fg, pair.bg);
      expect(ratio).toBeGreaterThanOrEqual(THRESHOLDS[pair.level]);
    });
  }
});
