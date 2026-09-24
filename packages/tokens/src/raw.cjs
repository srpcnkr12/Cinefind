/**
 * Ham token değerleri — tek kaynak (PRD bölüm 15.2/15.3).
 * CommonJS: apps/mobile/tailwind.config.js Metro tarafından bu dosyayı
 * doğrudan `require()` ile (bundler/transpile olmadan) okur; bu yüzden
 * TypeScript/ESM sözdizimi kullanılmaz. Tip bilgisi için bkz. raw.d.cts.
 */
exports.palette = {
  ink: "#1B2440",
  screen: "#F4F7FB",
  reel: "#17736E",
  ticket: "#F2547D",
  popcorn: "#FFC23D",
  celluloid: "#6E7689",
  danger: "#C4433B",
  success: "#1B6E49",
};

exports.surfaces = {
  light: { surface1: "#FFFFFF", surface2: "#E8EDF5" },
  dark: { surface1: "#252F52", surface2: "#313C63" },
};

exports.radius = {
  poster: 6,
  card: 16,
  sheet: 24,
  button: 12,
};

exports.typography = {
  fontFamily: {
    display: "Big Shoulders Display",
    body: "Hanken Grotesk",
  },
  scale: [12, 14, 16, 20, 28, 40, 56],
  lineHeight: {
    body: 1.45,
    display: 1.05,
  },
};
