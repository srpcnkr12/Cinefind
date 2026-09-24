import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { buildAlternates } from "@/lib/seo";
import { listCollections } from "@reelmate/api/films";
import type { Locale } from "@reelmate/core/domain/film";

export const revalidate = 86400; // 1 gün (PRD 6.2)

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "explore" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: buildAlternates(locale, "/explore"),
  };
}

export default async function ExplorePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("explore");
  const db = getSupabaseClient();
  const collections = await listCollections(db, locale as Locale);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-2 font-display text-4xl font-bold">{t("title")}</h1>
      <p className="mb-8 font-body text-ink dark:text-screen">
        {t("subtitle")}
      </p>
      <ul className="grid gap-6 md:grid-cols-2">
        {collections.map((collection) => (
          <li key={collection.id} className="rounded-card bg-surface-1 p-6">
            <Link href={`/explore/${collection.slug}`}>
              <h2 className="font-body text-lg font-semibold">
                {collection.title}
              </h2>
              {collection.intro ? (
                <p className="mt-1 font-body text-sm text-ink dark:text-screen">
                  {collection.intro}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
