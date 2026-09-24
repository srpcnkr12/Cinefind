import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { buildAlternates, absoluteUrl } from "@/lib/seo";
import { getCollectionBySlug } from "@reelmate/api/films";
import { tmdbImageUrl } from "@reelmate/core/domain/film";
import {
  buildItemListJsonLd,
  buildBreadcrumbJsonLd,
} from "@reelmate/core/seo/json-ld";
import type { Locale } from "@reelmate/core/domain/film";

export const revalidate = 86400; // 1 gün (PRD 6.2)

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  const db = getSupabaseClient();
  const { data } = await db
    .from("collections")
    .select("slug")
    .eq("is_published", true)
    .limit(200);
  return (data ?? []).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const db = getSupabaseClient();
  const collection = await getCollectionBySlug(db, slug, locale as Locale);
  if (!collection) return {};
  return {
    title: `${collection.title} | Reelmate`,
    description: collection.intro ?? undefined,
    alternates: buildAlternates(locale, `/explore/${slug}`),
  };
}

export default async function CollectionDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  const db = getSupabaseClient();
  const collection = await getCollectionBySlug(db, slug, locale as Locale);
  if (!collection) notFound();
  const t = await getTranslations("filmDetail");
  const tExplore = await getTranslations("explore");

  const canonicalUrl = absoluteUrl(locale, `/explore/${slug}`);
  const itemListJsonLd = buildItemListJsonLd(
    collection.films.map((f) => ({
      name: f.title,
      url: absoluteUrl(locale, `/films/${f.slug}`),
    })),
  );
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: absoluteUrl(locale, "") },
    { name: tExplore("title"), url: absoluteUrl(locale, "/explore") },
    { name: collection.title, url: canonicalUrl },
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([itemListJsonLd, breadcrumbJsonLd]),
        }}
      />
      <h1 className="mb-2 font-display text-4xl font-bold">
        {collection.title}
      </h1>
      {collection.intro ? (
        <p className="mb-8 font-body text-ink dark:text-screen">
          {collection.intro}
        </p>
      ) : null}

      <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
        {collection.films.map((film) => (
          <li key={film.id}>
            <Link href={`/films/${film.slug}`} className="block">
              <div className="aspect-[2/3] overflow-hidden rounded-poster bg-surface-1">
                {film.posterPath ? (
                  <Image
                    src={tmdbImageUrl(film.posterPath, "w185") ?? ""}
                    alt={film.title}
                    width={185}
                    height={278}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <p className="mt-2 font-body text-sm font-semibold">
                {film.title}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
