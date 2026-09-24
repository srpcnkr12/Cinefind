import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { toString as qrCodeToString } from "qrcode";
import { getDownloadUrl } from "@/lib/attribution";
import { absoluteUrl, buildAlternates } from "@/lib/seo";
import { DownloadCta } from "@/components/download-cta";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "download" });
  return {
    title: t("title"),
    alternates: buildAlternates(locale, "/download"),
  };
}

function detectMobileTarget(userAgent: string): "ios" | "android" | null {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return null;
}

export default async function DownloadPage({ params }: Props) {
  const { locale } = await params;
  const userAgent = (await headers()).get("user-agent") ?? "";
  const mobileTarget = detectMobileTarget(userAgent);

  if (mobileTarget) {
    redirect(getDownloadUrl(mobileTarget, "download_page"));
  }

  const t = await getTranslations("download");
  const tLanding = await getTranslations("landing");
  const qrSvg = await qrCodeToString(absoluteUrl(locale, "/download"), {
    type: "svg",
    width: 200,
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-12 text-center">
      <h1 className="font-display text-4xl font-bold">{t("title")}</h1>
      <p className="max-w-[60ch] font-body text-ink dark:text-screen">
        {t("body")}
      </p>
      <div
        className="rounded-card bg-surface-1 p-4"
        // qrcode kütüphanesinin ürettiği statik SVG — kullanıcı girdisi içermez.
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <p className="font-body text-sm text-ink dark:text-screen">
        {t("qrHint")}
      </p>
      <DownloadCta
        position="download_page"
        appStoreLabel={tLanding("appStore")}
        googlePlayLabel={tLanding("googlePlay")}
      />
    </main>
  );
}
