// Paylaşılan ESLint flat config parçaları. Her app/paket kendi eslint.config.js'inde
// bunları kendi çerçeve preset'ine (Next/Expo) göre bileştirir.
//
// `tsRecommended` özellikle ayrı export edilir: eslint-config-expo kendi
// typescript-eslint kurulumunu zaten içerir, tekrar eklenirse ESLint flat config
// "Cannot redefine plugin" hatası verir. Bu yüzden apps/mobile bunu KULLANMAZ.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import i18next from "eslint-plugin-i18next";
import prettierConfig from "eslint-config-prettier";

export const jsRecommended = js.configs.recommended;
export const tsRecommended = tseslint.configs.recommended;
export const i18nextRecommended = i18next.configs["flat/recommended"];
export { prettierConfig };

export const ignoresConfig = {
  ignores: [
    "**/dist/**",
    "**/.next/**",
    "**/.expo/**",
    "**/.turbo/**",
    "**/node_modules/**",
    "**/coverage/**",
    // Kök seviyesi araç konfigürasyon dosyaları uygulama kodu değildir ve
    // eslint-plugin-react@7.37.5 + ESLint 10 kombinasyonunda react/display-name'in
    // React sürüm tespiti bu dosyalarda çöküyor (yukarı akış hatası, bkz.
    // jsx-eslint/eslint-plugin-react). Linte değer katmadıkları için atlanır.
    "*.config.js",
    "*.config.cjs",
    "*.config.mjs",
    "*.config.ts",
  ],
};

// eslint-plugin-react@7.37.5, `settings.react.version` verilmediğinde ESLint 10'un
// kaldırdığı eski `context.getFilename()` API'sini çağırarak çöküyor (react/display-name
// vb. kurallarda). Sürümü elle vermek otomatik tespiti (ve çökmeyi) devre dışı bırakır.
export const reactVersionConfig = {
  settings: { react: { version: "19.2" } },
};

export const commonRulesConfig = {
  rules: {
    // Kullanıcıya görünen her metin packages/i18n'den gelir (CLAUDE.md kural #4).
    "i18next/no-literal-string": "error",
  },
};

// `@typescript-eslint/*` sadece TS dosyalarını hedefleyen bir config objesinde
// tanımlanmalı — aksi halde plugin'i .js/.mjs gibi TS-olmayan dosyalarda
// (ör. tailwind.config.js) kayıtlı bulamayıp ESLint hata verir.
export const tsRulesConfig = {
  files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
};

// NativeWind/Metro'nun doğrudan `require()` ile okuduğu CommonJS dosyaları
// (bkz. packages/tokens/src/raw.cjs, tailwind-preset.cjs).
export const cjsOverrideConfig = {
  files: ["**/*.cjs"],
  languageOptions: {
    sourceType: "commonjs",
    globals: { module: "writable", exports: "writable", require: "readonly" },
  },
  rules: {
    "@typescript-eslint/no-require-imports": "off",
  },
};

/** @type {import("eslint").Linter.Config[]} */
export const baseConfig = [
  jsRecommended,
  ...tsRecommended,
  i18nextRecommended,
  prettierConfig,
  ignoresConfig,
  commonRulesConfig,
  tsRulesConfig,
  cjsOverrideConfig,
  reactVersionConfig,
];

export default baseConfig;
