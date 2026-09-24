import { getTranslations } from "next-intl/server";

type Props = { title: string; placeholder: string };

/** PRD 19 (Faz 2): "yasal sayfalar için şablon (metinler hukukçu onayı bekliyor olarak işaretli)". */
export async function LegalPage({ title, placeholder }: Props) {
  const t = await getTranslations("legal");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-4 font-display text-4xl font-bold">{title}</h1>
      <p className="mb-6 rounded-card bg-popcorn/20 px-4 py-3 font-body text-sm text-ink">
        {t("pendingNotice")}
      </p>
      <p className="font-body text-sm text-ink dark:text-screen">
        {placeholder}
      </p>
    </main>
  );
}
