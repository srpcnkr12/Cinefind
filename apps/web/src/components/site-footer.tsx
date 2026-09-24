import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export async function SiteFooter({ locale }: { locale: string }) {
  const tNav = await getTranslations("nav");
  const tFooter = await getTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-celluloid/20 px-6 py-10 font-body text-sm text-ink dark:text-screen">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap gap-5">
          <Link href="/explore">{tNav("explore")}</Link>
          <Link href="/films">{tNav("films")}</Link>
          <Link href="/people">{tNav("people")}</Link>
          <Link href="/popular">{tNav("popular")}</Link>
          <Link href="/blog">{tNav("blog")}</Link>
        </div>
        <div className="flex flex-wrap gap-5">
          <Link href="/privacy">{tFooter("legalPrivacy")}</Link>
          <Link href="/terms">{tFooter("legalTerms")}</Link>
          <Link href="/kvkk">{tFooter("legalKvkk")}</Link>
          <Link href="/community-guidelines">
            {tFooter("legalCommunityGuidelines")}
          </Link>
          <Link href="/safety">{tFooter("legalSafety")}</Link>
        </div>
        <div className="flex gap-3" aria-label={tFooter("languageLabel")}>
          {routing.locales.map((l) => (
            <Link
              key={l}
              href="/"
              locale={l}
              className={l === locale ? "font-semibold" : ""}
            >
              {l.toUpperCase()}
            </Link>
          ))}
        </div>
        <p>{tFooter("tmdbAttribution")}</p>
        <p>{tFooter("copyright", { year })}</p>
      </div>
    </footer>
  );
}
