import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { buildAlternates, absoluteUrl } from "@/lib/seo";
import { getPersonBySlug } from "@reelmate/api/films";
import { tmdbImageUrl } from "@reelmate/core/domain/film";
import {
  buildPersonJsonLd,
  buildBreadcrumbJsonLd,
} from "@reelmate/core/seo/json-ld";
import type { Locale } from "@reelmate/core/domain/film";

export const revalidate = 86400; // 1 gün (PRD 6.2)

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  const db = getSupabaseClient();
  const { data } = await db.from("people").select("slug").limit(200);
  return (data ?? []).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const db = getSupabaseClient();
  const person = await getPersonBySlug(db, slug, locale as Locale);
  if (!person) return {};
  return {
    title: `${person.name} | Reelmate`,
    alternates: buildAlternates(locale, `/people/${slug}`),
  };
}

export default async function PersonDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  const db = getSupabaseClient();
  const person = await getPersonBySlug(db, slug, locale as Locale);
  if (!person) notFound();
  const t = await getTranslations("filmDetail");
  const tNav = await getTranslations("nav");

  const canonicalUrl = absoluteUrl(locale, `/people/${slug}`);
  const personJsonLd = buildPersonJsonLd({
    url: canonicalUrl,
    name: person.name,
    image: person.profilePath
      ? (tmdbImageUrl(person.profilePath, "w185") ?? undefined)
      : undefined,
    jobTitle: person.knownForDepartment,
  });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: absoluteUrl(locale, "") },
    { name: tNav("people"), url: absoluteUrl(locale, "/people") },
    { name: person.name, url: canonicalUrl },
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([personJsonLd, breadcrumbJsonLd]),
        }}
      />
      <h1 className="mb-2 font-display text-4xl font-bold">{person.name}</h1>
      {person.knownForDepartment ? (
        <p className="mb-8 font-body text-ink dark:text-screen">
          {person.knownForDepartment}
        </p>
      ) : null}

      <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
        {person.filmography.map((film) => (
          <li key={`${film.id}-${film.role}`}>
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
