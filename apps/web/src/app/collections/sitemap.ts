import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/seo";
import { getSupabaseClient } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const db = getSupabaseClient();
  const { data } = await db
    .from("collections")
    .select("slug")
    .eq("is_published", true)
    .limit(1000);

  return (data ?? []).map(({ slug }) => ({
    url: `${siteUrl}/${routing.defaultLocale}/explore/${slug}`,
    changeFrequency: "weekly",
    priority: 0.5,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `${siteUrl}/${l}/explore/${slug}`]),
      ),
    },
  }));
}
