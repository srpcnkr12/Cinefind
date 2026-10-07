import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { ThemeInitScript } from "@/components/theme-init-script";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { brand } from "@movieholix/config/brand";
import {
  buildOrganizationJsonLd,
  buildMobileApplicationJsonLd,
} from "@movieholix/core/seo/json-ld";
import "../globals.css";

// "Big Shoulders Display" next/font/google kataloğunda yok (bkz. docs/adr/0003-fonts.md),
// bu yüzden self-host edilen değişken (variable) font dosyasından yüklenir.
const displayFont = localFont({
  src: "../../fonts/BigShouldersDisplay-Variable.ttf",
  variable: "--font-display",
  weight: "100 900",
  style: "normal",
  display: "swap",
});

const bodyFont = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: brand.name,
  description: brand.legalName,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${displayFont.variable} ${bodyFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeInitScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              buildOrganizationJsonLd({
                name: brand.name,
                url: `https://${brand.domain}`,
              }),
              buildMobileApplicationJsonLd({
                name: brand.name,
                url: `https://${brand.domain}`,
                operatingSystems: ["iOS", "Android"],
              }),
            ]),
          }}
        />
      </head>
      <body className="bg-screen font-body text-ink antialiased dark:bg-ink dark:text-screen">
        <NextIntlClientProvider messages={messages}>
          <SiteHeader />
          {children}
          <SiteFooter locale={locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
