import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return { title: t("title"), alternates: buildAlternates(locale, "/blog") };
}

/**
 * Rota altyapısı hazır (MDX destekli yazı sayfaları `[slug]/page.tsx` altında
 * eklenebilir) ama gerçek yazı yok — editoryal iş, bkz. docs/adr/0005.
 */
export default async function BlogPage() {
  const t = await getTranslations("blog");
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-center">
      <h1 className="mb-4 font-display text-4xl font-bold">{t("title")}</h1>
      <p className="font-body text-ink dark:text-screen">{t("comingSoon")}</p>
    </main>
  );
}
