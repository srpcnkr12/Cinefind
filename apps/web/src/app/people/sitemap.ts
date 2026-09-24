import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/seo";
import { getSupabaseClient } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const db = getSupabaseClient();
  const { data } = await db.from("people").select("slug").limit(50000);

  return (data ?? []).map(({ slug }) => ({
    url: `${siteUrl}/${routing.defaultLocale}/people/${slug}`,
    changeFrequency: "monthly",
    priority: 0.4,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `${siteUrl}/${l}/people/${slug}`]),
      ),
    },
  }));
}
