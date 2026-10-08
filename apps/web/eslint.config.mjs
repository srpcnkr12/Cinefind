import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { baseConfig } from "@movieholix/config/eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...baseConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Admin panel yalnızca ekip içi kullanılıyor, son kullanıcıya hiç
    // görünmüyor — metinleri bilinçli olarak sabit Türkçe (bkz.
    // docs/adr/0015-admin-panel-no-i18n.md, CLAUDE.md kural #4'ten
    // onaylanmış sapma).
    files: ["src/app/admin/**/*.{ts,tsx}"],
    rules: {
      "i18next/no-literal-string": "off",
    },
  },
]);

export default eslintConfig;
