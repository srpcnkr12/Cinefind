import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { buildAlternates } from "@/lib/seo";
import { listFilms } from "@movieholix/api/films";
import { tmdbImageUrl } from "@movieholix/core/domain/film";
import type { Locale } from "@movieholix/core/domain/film";

export const revalidate = 21600; // 6 saat (PRD 6.2)

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "films" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: buildAlternates(locale, "/films"),
  };
}

export default async function FilmsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("films");
  const db = getSupabaseClient();
  const { items } = await listFilms(db, locale as Locale, 1);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-2 font-display text-4xl font-bold">{t("title")}</h1>
      <p className="mb-8 font-body text-ink dark:text-screen">
        {t("subtitle")}
      </p>
      <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
        {items.map((film) => (
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
              {film.releaseYear ? (
                <p className="font-body text-xs text-ink dark:text-screen">
                  {film.releaseYear}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
