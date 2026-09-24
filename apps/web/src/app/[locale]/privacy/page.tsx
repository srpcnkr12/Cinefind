import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";
import { buildAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return {
    title: t("privacyTitle"),
    alternates: buildAlternates(locale, "/privacy"),
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations("legal");
  return (
    <LegalPage
      title={t("privacyTitle")}
      placeholder={t("privacyPlaceholder")}
    />
  );
}
