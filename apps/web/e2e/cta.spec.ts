import { expect, test } from "@playwright/test";

/**
 * PRD 18.1: CTA bağlantı parametreleri.
 * Mağaza URL'leri NEXT_PUBLIC_* olduğu için derleme anında gömülüyor;
 * playwright.config.ts bunları webServer env'inde sağlıyor.
 */

test("indirme CTA'ları mağaza linkine attribution parametreleriyle gidiyor", async ({
  page,
}) => {
  await page.goto("/tr/download");

  const ios = page.locator('a[href*="apps.apple.com"]').first();
  const android = page.locator('a[href*="play.google.com"]').first();
  await expect(ios).toBeVisible();
  await expect(android).toBeVisible();

  for (const [name, link] of [
    ["ios", ios],
    ["android", android],
  ] as const) {
    const href = await link.getAttribute("href");
    expect(href, `${name} CTA href yok`).toBeTruthy();
    const url = new URL(href as string);
    expect(url.searchParams.get("campaign")).toBe("web");
    expect(url.searchParams.get("target")).toBe(name);
    // adgroup CTA'nın sayfadaki konumunu taşır (PRD 17.1 web_cta_clicked.position).
    expect(url.searchParams.get("adgroup")).toBeTruthy();
  }
});

test("CTA adgroup'u sayfadaki konumu taşıyor (PRD 17.1 web_cta_clicked.position)", async ({
  page,
}) => {
  async function adgroupOf(path: string): Promise<string | null> {
    await page.goto(path);
    const href = await page
      .locator('a[href*="apps.apple.com"]')
      .first()
      .getAttribute("href");
    expect(href, `${path} sayfasında iOS CTA'sı yok`).toBeTruthy();
    return new URL(href as string).searchParams.get("adgroup");
  }

  expect(await adgroupOf("/tr")).toBe("hero");
  expect(await adgroupOf("/tr/download")).toBe("download_page");

  await page.goto("/tr/films");
  await page.locator('a[href^="/tr/films/"]').first().click();
  await page.waitForURL(/\/tr\/films\/.+/);
  const filmHref = await page
    .locator('a[href*="apps.apple.com"]')
    .first()
    .getAttribute("href");
  expect(filmHref, "film detayında iOS CTA'sı yok").toBeTruthy();
  expect(new URL(filmHref as string).searchParams.get("adgroup")).toBe(
    "film_inline",
  );
});
