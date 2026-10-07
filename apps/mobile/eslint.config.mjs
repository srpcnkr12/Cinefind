import expoConfig from "eslint-config-expo/flat.js";
import {
  i18nextRecommended,
  prettierConfig,
  ignoresConfig,
  commonRulesConfig,
  tsRulesConfig,
  cjsOverrideConfig,
  reactVersionConfig,
} from "@movieholix/config/eslint";

export default [
  ...expoConfig,
  i18nextRecommended,
  prettierConfig,
  ignoresConfig,
  commonRulesConfig,
  tsRulesConfig,
  cjsOverrideConfig,
  reactVersionConfig,
  {
    ignores: ["dist/**", ".expo/**"],
  },
];
