/**
 * schema.org JSON-LD üreticileri (PRD 6.1: Movie, Person, ItemList, BreadcrumbList,
 * FAQPage, Organization, MobileApplication). Saf fonksiyonlar — `apps/web` bunları
 * `<script type="application/ld+json">` içine `JSON.stringify` ederek gömer.
 */

// ISO 8601 duration: dakikayı "PT98M" biçimine çevirir.
function toIsoDuration(minutes: number | null): string | undefined {
  if (!minutes || minutes <= 0) return undefined;
  return `PT${minutes}M`;
}

export type MovieJsonLdInput = {
  url: string;
  name: string;
  alternateName?: string;
  description?: string | null;
  image?: string | null;
  datePublished?: string | null;
  durationMinutes?: number | null;
  countryOfOrigin?: string[];
  genres?: string[];
  directors?: { name: string; url?: string }[];
  cast?: { name: string; url?: string; character?: string | null }[];
};

export function buildMovieJsonLd(input: MovieJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Movie",
    url: input.url,
    name: input.name,
    ...(input.alternateName && input.alternateName !== input.name
      ? { alternateName: input.alternateName }
      : {}),
    ...(input.description ? { description: input.description } : {}),
    ...(input.image ? { image: input.image } : {}),
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(toIsoDuration(input.durationMinutes ?? null)
      ? { duration: toIsoDuration(input.durationMinutes ?? null) }
      : {}),
    ...(input.countryOfOrigin && input.countryOfOrigin.length > 0
      ? {
          countryOfOrigin: input.countryOfOrigin.map((code) => ({
            "@type": "Country",
            name: code,
          })),
        }
      : {}),
    ...(input.genres && input.genres.length > 0 ? { genre: input.genres } : {}),
    ...(input.directors && input.directors.length > 0
      ? {
          director: input.directors.map((d) => ({
            "@type": "Person",
            name: d.name,
            ...(d.url ? { url: d.url } : {}),
          })),
        }
      : {}),
    ...(input.cast && input.cast.length > 0
      ? {
          actor: input.cast.map((a) => ({
            "@type": "Person",
            name: a.name,
            ...(a.url ? { url: a.url } : {}),
          })),
        }
      : {}),
  };
}

export function buildPersonJsonLd(input: {
  url: string;
  name: string;
  image?: string | null;
  jobTitle?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    url: input.url,
    name: input.name,
    ...(input.image ? { image: input.image } : {}),
    ...(input.jobTitle ? { jobTitle: input.jobTitle } : {}),
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildItemListJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export function buildFaqJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function buildOrganizationJsonLd(input: {
  name: string;
  url: string;
  logoUrl?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    url: input.url,
    ...(input.logoUrl ? { logo: input.logoUrl } : {}),
  };
}

export function buildMobileApplicationJsonLd(input: {
  name: string;
  url: string;
  operatingSystems: string[];
  applicationCategory?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    name: input.name,
    url: input.url,
    operatingSystem: input.operatingSystems.join(", "),
    applicationCategory: input.applicationCategory ?? "LifestyleApplication",
  };
}
