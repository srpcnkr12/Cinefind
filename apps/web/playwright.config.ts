import { defineConfig, devices } from "@playwright/test";

/**
 * PRD 18.1 web E2E'si. Testler ÜRETİM derlemesine karşı koşuyor (`next start`),
 * çünkü doğrulanan şeylerin çoğu — hreflang alternates, JSON-LD, statik
 * üretilen sayfalar — yalnızca derlenmiş çıktıda gerçek hâlini alıyor.
 *
 * Derleme Supabase'e gerçekten bağlanıyor (generateStaticParams katalogdan
 * okuyor), bu yüzden `pnpm db:reset` + tmdb-sync yapılmış ayakta bir yerel
 * Supabase gerekiyor. CI'da zaten tam yığın başlatılıyor.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Mağaza linkleri NEXT_PUBLIC_* olduğu için derleme anında gömülüyor;
    // CTA parametrelerini sınayabilmek için derlemeyi burada yapıyoruz.
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 10 * 60 * 1000,
    env: {
      NEXT_PUBLIC_APP_STORE_URL: "https://apps.apple.com/app/id000000000",
      NEXT_PUBLIC_PLAY_STORE_URL:
        "https://play.google.com/store/apps/details?id=app.movieholix.mobile",
      NEXT_PUBLIC_SITE_URL: baseURL,
    },
  },
});
