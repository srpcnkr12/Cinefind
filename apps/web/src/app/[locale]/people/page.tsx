import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { buildAlternates } from "@/lib/seo";

export const revalidate = 86400; // 1 gün (PRD 6.2)

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("people"), alternates: buildAlternates(locale, "/people") };
}

export default async function PeoplePage() {
  const t = await getTranslations("nav");
  const db = getSupabaseClient();
  const { data } = await db
    .from("people")
    .select("id, slug, name")
    .order("tmdb_popularity", { ascending: false })
    .limit(100);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-8 font-display text-4xl font-bold">{t("people")}</h1>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {(data ?? []).map((person) => (
          <li key={person.id}>
            <Link
              href={`/people/${person.slug}`}
              className="font-body text-sm underline"
            >
              {person.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
