/**
 * Tailwind v3-style preset — NativeWind (apps/mobile) tarafından tüketilir.
 * (Web'de Tailwind v4 CSS-first `@theme` kullanılır, bkz. apps/web/src/app/globals.css;
 * oradaki CSS değişkenleri bu dosyadaki değerlerle elle senkron tutulur.)
 */
const { palette, surfaces, radius, typography } = require("./src/raw.cjs");

/** @type {import("tailwindcss").Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        ink: palette.ink,
        screen: palette.screen,
        reel: palette.reel,
        ticket: palette.ticket,
        popcorn: palette.popcorn,
        celluloid: palette.celluloid,
        danger: palette.danger,
        success: palette.success,
        "surface-1-light": surfaces.light.surface1,
        "surface-2-light": surfaces.light.surface2,
        "surface-1-dark": surfaces.dark.surface1,
        "surface-2-dark": surfaces.dark.surface2,
      },
      fontFamily: {
        display: [typography.fontFamily.display],
        body: [typography.fontFamily.body],
      },
      fontSize: Object.fromEntries(
        typography.scale.map((size) => [`t${size}`, `${size}px`]),
      ),
      borderRadius: {
        poster: `${radius.poster}px`,
        card: `${radius.card}px`,
        sheet: `${radius.sheet}px`,
        button: `${radius.button}px`,
      },
    },
  },
};
