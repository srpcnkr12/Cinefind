import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/seo";

const STATIC_PATHS: {
  path: string;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
}[] = [
  { path: "", priority: 1, changeFrequency: "weekly" },
  { path: "/explore", priority: 0.7, changeFrequency: "daily" },
  { path: "/popular", priority: 0.7, changeFrequency: "daily" },
  { path: "/blog", priority: 0.5, changeFrequency: "weekly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/kvkk", priority: 0.3, changeFrequency: "yearly" },
  { path: "/community-guidelines", priority: 0.3, changeFrequency: "yearly" },
  { path: "/safety", priority: 0.3, changeFrequency: "yearly" },
];

/** PRD 6.1: bölünmüş sitemap — bu dosya statik/landing sayfaları kapsar. Film/kişi/koleksiyon için ayrı dosyalar. */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  return STATIC_PATHS.map(({ path, priority, changeFrequency }) => ({
    url: `${siteUrl}/${routing.defaultLocale}${path}`,
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `${siteUrl}/${l}${path}`]),
      ),
    },
  }));
}
