import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { buildAlternates, absoluteUrl } from "@/lib/seo";
import { DownloadCta } from "@/components/download-cta";
import { StickyDownloadBar } from "@/components/sticky-download-bar";
import {
  getFilmBySlug,
  listSimilarFilms,
  listFilmsByPerson,
  getFilmCommunity,
} from "@reelmate/api/films";
import { tmdbImageUrl } from "@reelmate/core/domain/film";
import {
  buildMovieJsonLd as buildMovie,
  buildBreadcrumbJsonLd as buildBreadcrumb,
} from "@reelmate/core/seo/json-ld";
import type { Locale } from "@reelmate/core/domain/film";

export const revalidate = 86400; // 1 gün (PRD 6.2)

type Props = { params: Promise<{ locale: string; slug: string }> };

async function loadFilm(locale: string, slug: string) {
  const db = getSupabaseClient();
  const film = await getFilmBySlug(db, slug, locale as Locale);
  if (!film) return null;
  const [similar, directorFilms, community] = await Promise.all([
    listSimilarFilms(db, film, locale as Locale, 6),
    film.directors[0]
      ? listFilmsByPerson(
          db,
          film.directors[0].id,
          "director",
          locale as Locale,
          film.id,
          6,
        )
      : Promise.resolve([]),
    getFilmCommunity(db, film.id),
  ]);
  return { film, similar, directorFilms, community };
}

export async function generateStaticParams() {
  const db = getSupabaseClient();
  const { data } = await db
    .from("films")
    .select("slug")
    .not("tmdb_synced_at", "is", null)
    .limit(200);
  return (data ?? []).map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const result = await loadFilm(locale, slug);
  if (!result) return {};
  const { film } = result;
  const t = await getTranslations({ locale, namespace: "filmDetail" });
  const title = film.releaseYear
    ? t("titleTemplate", { title: film.title, year: film.releaseYear })
    : t("titleTemplateNoYear", { title: film.title });

  return {
    title,
    description: film.overview ?? film.title,
    alternates: buildAlternates(locale, `/films/${slug}`),
    openGraph: {
      title,
      description: film.overview ?? undefined,
      images: film.posterPath
        ? [tmdbImageUrl(film.posterPath, "w500") ?? ""]
        : undefined,
    },
  };
}

export default async function FilmDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  const result = await loadFilm(locale, slug);
  if (!result) notFound();
  const { film, similar, directorFilms, community } = result;
  const t = await getTranslations("filmDetail");

  const canonicalUrl = absoluteUrl(locale, `/films/${slug}`);
  const movieJsonLd = buildMovie({
    url: canonicalUrl,
    name: film.title,
    alternateName: film.originalTitle,
    description: film.overview,
    image: film.posterPath
      ? (tmdbImageUrl(film.posterPath, "w500") ?? undefined)
      : undefined,
    datePublished: film.releaseDate,
    durationMinutes: film.runtime,
    countryOfOrigin: film.countries,
    genres: film.genres.map((g) => g.name),
    directors: film.directors.map((d) => ({
      name: d.name,
      url: absoluteUrl(locale, `/people/${d.slug}`),
    })),
    cast: film.cast.map((c) => ({
      name: c.name,
      url: absoluteUrl(locale, `/people/${c.slug}`),
      character: c.character,
    })),
  });
  const breadcrumbJsonLd = buildBreadcrumb([
    { name: t("breadcrumbHome"), url: absoluteUrl(locale, "") },
    { name: t("breadcrumbFilms"), url: absoluteUrl(locale, "/films") },
    { name: film.title, url: canonicalUrl },
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([movieJsonLd, breadcrumbJsonLd]),
        }}
      />

      <nav
        aria-label="breadcrumb"
        className="mb-6 font-body text-sm text-ink dark:text-screen"
      >
        <Link href="/">{t("breadcrumbHome")}</Link> /{" "}
        <Link href="/films">{t("breadcrumbFilms")}</Link> / {film.title}
      </nav>

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <div className="aspect-[2/3] w-full overflow-hidden rounded-poster bg-surface-1">
          {film.posterPath ? (
            <Image
              src={tmdbImageUrl(film.posterPath, "w500") ?? ""}
              alt={film.title}
              width={500}
              height={750}
              className="h-full w-full object-cover"
              priority
            />
          ) : null}
        </div>

        <div>
          {film.genres.length > 0 ? (
            <p className="font-body text-sm text-ink dark:text-screen">
              {film.genres.map((g) => g.name).join(", ")}
            </p>
          ) : null}
          <h1 className="mt-1 font-display text-4xl font-bold">{film.title}</h1>
          {film.title !== film.originalTitle ? (
            <p className="font-body text-ink dark:text-screen">
              {film.originalTitle}
            </p>
          ) : null}
          {film.directors.length > 0 ? (
            <p className="mt-2 font-body text-sm">
              {t("director")}:{" "}
              {film.directors.map((d, i) => (
                <span key={d.id}>
                  {i > 0 ? ", " : ""}
                  <Link href={`/people/${d.slug}`} className="underline">
                    {d.name}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
          <p className="mt-1 font-body text-sm text-ink dark:text-screen">
            {[
              film.releaseYear,
              film.runtime ? `${film.runtime} ${t("minutes")}` : null,
              film.countries.join(", "),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <DownloadCta
              position="film_inline"
              appStoreLabel={t("addToListCta")}
              googlePlayLabel={t("shareCta")}
            />
          </div>

          {film.overview ? (
            <section className="mt-8">
              <h2 className="mb-2 font-body text-lg font-semibold">
                {t("aboutFilm")}
              </h2>
              <p className="max-w-[72ch] font-body text-sm">{film.overview}</p>
            </section>
          ) : null}

          {film.cast.length > 0 || film.directors.length > 0 ? (
            <section className="mt-8">
              <h2 className="mb-2 font-body text-lg font-semibold">
                {t("castAndCrew")}
              </h2>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 font-body text-sm">
                {[...film.directors, ...film.cast].map((p) => (
                  <li key={`${p.id}-${p.character ?? "director"}`}>
                    <Link href={`/people/${p.slug}`} className="underline">
                      {p.name}
                    </Link>
                    {p.character ? ` (${p.character})` : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-8">
            <h2 className="mb-2 font-body text-lg font-semibold">
              {t("whereToWatch")}
            </h2>
            <p className="font-body text-sm text-ink dark:text-screen">
              {t("whereToWatchUnavailable")}
            </p>
            <p className="mt-1 font-body text-xs text-ink dark:text-screen">
              {t("justwatchAttribution")}
            </p>
          </section>

          {directorFilms.length > 0 ? (
            <FilmRow title={t("directorsOtherFilms")} films={directorFilms} />
          ) : null}
          {similar.length > 0 ? (
            <FilmRow title={t("similarFilms")} films={similar} />
          ) : null}

          <section className="mt-8">
            <h2 className="mb-2 font-body text-lg font-semibold">
              {t("communityTitle", {
                posts: community.posts.length,
                lines: community.lines.length,
              })}
            </h2>
            {community.averageRating ? (
              <p className="mb-3 font-body text-sm text-ink dark:text-screen">
                {t("communityAverageRating", {
                  rating: community.averageRating.toFixed(1),
                  count: community.ratingCount,
                })}
              </p>
            ) : null}

            {community.lines.length > 0 ? (
              <ul className="mb-4 flex flex-col gap-2">
                {community.lines.slice(0, 5).map((line) => (
                  <li
                    key={line.id}
                    className="font-body text-sm italic text-ink dark:text-screen"
                  >
                    &ldquo;{line.text}&rdquo;
                    {line.characterName ? (
                      <span className="not-italic text-xs text-ink/60 dark:text-screen/60">
                        {" "}
                        — {line.characterName}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {community.posts.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {community.posts.map((post) => (
                  <li
                    key={post.id}
                    className="rounded-card bg-surface-1 p-4 text-sm"
                  >
                    <p className="font-body-semibold">
                      {post.authorDisplayName ?? `@${post.authorUsername}`}
                    </p>
                    {post.body ? (
                      <p className="mt-1 font-body">{post.body}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-body text-sm text-ink dark:text-screen">
                {t("communityEmpty")}
              </p>
            )}
          </section>

          <section className="mt-12 rounded-card bg-surface-1 p-6 text-center">
            <h2 className="mb-4 font-display text-2xl font-bold">
              {t("meetSomeoneTitle")}
            </h2>
            <div className="flex justify-center">
              <DownloadCta
                position="film_inline"
                appStoreLabel={t("addToListCta")}
                googlePlayLabel={t("shareCta")}
              />
            </div>
          </section>
        </div>
      </div>

      <StickyDownloadBar text={t("stickyBarText")} closeLabel={t("shareCta")} />
    </main>
  );
}

function FilmRow({
  title,
  films,
}: {
  title: string;
  films: {
    id: string;
    slug: string;
    title: string;
    posterPath: string | null;
  }[];
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 font-body text-lg font-semibold">{title}</h2>
      <div className="flex gap-4 overflow-x-auto">
        {films.map((f) => (
          <Link key={f.id} href={`/films/${f.slug}`} className="w-24 shrink-0">
            <div className="aspect-[2/3] overflow-hidden rounded-poster bg-surface-2">
              {f.posterPath ? (
                <Image
                  src={tmdbImageUrl(f.posterPath, "w185") ?? ""}
                  alt={f.title}
                  width={92}
                  height={138}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <p className="mt-1 truncate font-body text-xs">{f.title}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
