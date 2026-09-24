import { defineRouting } from "next-intl/routing";
import { brand } from "@reelmate/config/brand";

export const routing = defineRouting({
  locales: [...brand.locales],
  defaultLocale: brand.defaultLocale,
});
