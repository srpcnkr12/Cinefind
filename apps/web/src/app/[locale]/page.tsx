import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DownloadCta } from "@/components/download-cta";
import { buildAlternates } from "@/lib/seo";
import { buildFaqJsonLd } from "@movieholix/core/seo/json-ld";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  return {
    title: t("heroTitle"),
    description: t("heroSubtitle"),
    alternates: buildAlternates(locale, ""),
  };
}

export default async function HomePage() {
  const t = await getTranslations("landing");

  const steps = [
    { title: t("howItWorksStep1Title"), body: t("howItWorksStep1Body") },
    { title: t("howItWorksStep2Title"), body: t("howItWorksStep2Body") },
    { title: t("howItWorksStep3Title"), body: t("howItWorksStep3Body") },
  ];
  const features = [
    { title: t("feature1Title"), body: t("feature1Body") },
    { title: t("feature2Title"), body: t("feature2Body") },
    { title: t("feature3Title"), body: t("feature3Body") },
  ];
  const faqs = [
    { question: t("faqQ1"), answer: t("faqA1") },
    { question: t("faqQ2"), answer: t("faqA2") },
    { question: t("faqQ3"), answer: t("faqA3") },
    { question: t("faqQ4"), answer: t("faqA4") },
    { question: t("faqQ5"), answer: t("faqA5") },
    { question: t("faqQ6"), answer: t("faqA6") },
    { question: t("faqQ7"), answer: t("faqA7") },
  ];

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildFaqJsonLd(
              faqs.map((f) => ({ question: f.question, answer: f.answer })),
            ),
          ),
        }}
      />

      <section className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-16 text-center">
        <h1 className="font-display text-5xl font-bold">{t("heroTitle")}</h1>
        <p className="mx-auto max-w-[72ch] font-body text-lg text-ink dark:text-screen">
          {t("heroSubtitle")}
        </p>
        <div className="mx-auto">
          <DownloadCta
            position="hero"
            appStoreLabel={t("appStore")}
            googlePlayLabel={t("googlePlay")}
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="mb-8 font-display text-3xl font-bold">
          {t("howItWorksTitle")}
        </h2>
        <ol className="grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-2">
              <span className="font-display text-3xl text-reel">
                {index + 1}
              </span>
              <h3 className="font-body text-lg font-semibold">{step.title}</h3>
              <p className="font-body text-sm text-ink dark:text-screen">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="mb-8 font-display text-3xl font-bold">
          {t("featuresTitle")}
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-card bg-surface-1 p-6">
              <h3 className="mb-2 font-body text-lg font-semibold">
                {feature.title}
              </h3>
              <p className="font-body text-sm text-ink dark:text-screen">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="mb-8 font-display text-3xl font-bold">
          {t("faqTitle")}
        </h2>
        <dl className="flex flex-col gap-6">
          {faqs.map((faq) => (
            <div key={faq.question}>
              <dt className="font-body font-semibold">{faq.question}</dt>
              <dd className="mt-1 font-body text-sm text-ink dark:text-screen">
                {faq.answer}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
