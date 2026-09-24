import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { brand } from "@reelmate/config/brand";

export async function SiteHeader() {
  const t = await getTranslations("nav");

  return (
    <header className="border-b border-celluloid/20">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-xl font-bold">
          {brand.name}
        </Link>
        <div className="flex gap-5 font-body text-sm">
          <Link href="/explore">{t("explore")}</Link>
          <Link href="/films">{t("films")}</Link>
          <Link href="/people">{t("people")}</Link>
          <Link href="/popular">{t("popular")}</Link>
          <Link href="/blog">{t("blog")}</Link>
        </div>
      </nav>
    </header>
  );
}
