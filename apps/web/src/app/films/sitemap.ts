import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/seo";
import { getSupabaseClient } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const db = getSupabaseClient();
  const { data } = await db
    .from("films")
    .select("slug")
    .not("tmdb_synced_at", "is", null)
    .limit(50000);

  return (data ?? []).map(({ slug }) => ({
    url: `${siteUrl}/${routing.defaultLocale}/films/${slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `${siteUrl}/${l}/films/${slug}`]),
      ),
    },
  }));
}
