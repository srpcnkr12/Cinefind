// Kendi eslint.config.js/mjs dosyası olmayan paketler (packages/*) ve depo
// kökündeki Node betikleri için düşen (fallback) kök config.
// apps/web ve apps/mobile kendi eslint.config'lerinde bunu (base) genişletir.
import { baseConfig } from "@movieholix/config/eslint";

export default [
  ...baseConfig,
  {
    // supabase/seed/* — yalnızca yerel/staging'de elle çalıştırılan Node
    // betikleri (demo verisi ve kapak görseli üretimi).
    files: ["supabase/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
      },
    },
  },
];
