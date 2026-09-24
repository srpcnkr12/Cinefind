import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "deleteAccount" });
  return {
    title: t("title"),
    alternates: buildAlternates(locale, "/delete-account"),
  };
}

/**
 * Google Play'in istediği statik hesap silme bilgi sayfası (PRD 14.4). Henüz bir
 * auth/hesap sistemi yok (Faz 3) — bu yüzden gerçek bir silme API'sine bağlı değil,
 * yalnızca uygulama içi adımları anlatır (bkz. docs/adr/0005).
 */
export default async function DeleteAccountPage() {
  const t = await getTranslations("deleteAccount");
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-4 font-display text-4xl font-bold">{t("title")}</h1>
      <p className="mb-4 font-body">{t("body")}</p>
      <p className="font-body text-sm text-ink dark:text-screen">
        {t("contactHint")}
      </p>
    </main>
  );
}
