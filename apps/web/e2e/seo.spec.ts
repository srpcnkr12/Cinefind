import { expect, test } from "@playwright/test";

/** PRD 18.1: hreflang ve JSON-LD doğrulama. */

test("landing açılıyor ve markayı gösteriyor", async ({ page }) => {
  await page.goto("/tr");
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator("header")).toContainText("Movieholix");
});

test("her sayfada tr/en/x-default hreflang var ve birbirini gösteriyor", async ({
  page,
}) => {
  for (const path of ["/tr", "/tr/films", "/tr/explore"]) {
    await page.goto(path);
    const tr = page.locator('link[rel="alternate"][hreflang="tr"]');
    const en = page.locator('link[rel="alternate"][hreflang="en"]');
    const xd = page.locator('link[rel="alternate"][hreflang="x-default"]');
    await expect(tr).toHaveCount(1);
    await expect(en).toHaveCount(1);
    await expect(xd).toHaveCount(1);

    const trHref = await tr.getAttribute("href");
    const enHref = await en.getAttribute("href");
    const xdHref = await xd.getAttribute("href");
    expect(trHref).toContain("/tr");
    expect(enHref).toContain("/en");
    // x-default varsayılan dile (tr) işaret etmeli.
    expect(xdHref).toBe(trHref);
  }
});

test("canonical her sayfada tekil", async ({ page }) => {
  await page.goto("/tr/films");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
});

test("film sayfasında geçerli Movie + BreadcrumbList JSON-LD var", async ({
  page,
}) => {
  await page.goto("/tr/films");
  await page.locator('a[href^="/tr/films/"]').first().click();
  await page.waitForURL(/\/tr\/films\/.+/);

  // Sayfada birden fazla ld+json bloğu var (layout Organization/MobileApplication
  // yazıyor, film sayfası kendi Movie/BreadcrumbList'ini ekliyor) — hepsi taranır.
  const rawBlocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(
    rawBlocks.length,
    "film sayfasında JSON-LD bulunamadı",
  ).toBeGreaterThan(0);

  const blocks = rawBlocks.flatMap((raw) => {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  });
  const types = blocks.map((b) => (b as { "@type"?: string })["@type"]);
  expect(types).toContain("Movie");
  expect(types).toContain("BreadcrumbList");

  const movie = blocks.find(
    (b) => (b as { "@type"?: string })["@type"] === "Movie",
  ) as { name?: string; "@context"?: string };
  expect(movie["@context"]).toBe("https://schema.org");
  expect(movie.name).toBeTruthy();
});

test("robots.txt ve sitemap'ler servis ediliyor", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap");

  for (const path of [
    "/sitemap.xml",
    "/films/sitemap.xml",
    "/people/sitemap.xml",
    "/collections/sitemap.xml",
  ]) {
    const res = await request.get(path);
    expect(res.status(), `${path} 200 dönmeli`).toBe(200);
    expect(await res.text()).toContain("<urlset");
  }
});
