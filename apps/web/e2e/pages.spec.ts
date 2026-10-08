import { expect, test } from "@playwright/test";

/** PRD 18.1: film sayfası, koleksiyon, dil değiştirme, 404'ler. */

test("film listesinden film detayına gidiliyor", async ({ page }) => {
  await page.goto("/tr/films");
  const first = page.locator('a[href^="/tr/films/"]').first();
  const title = (await first.textContent())?.trim();
  await first.click();
  await page.waitForURL(/\/tr\/films\/.+/);

  await expect(page.locator("h1").first()).toBeVisible();
  expect(title).toBeTruthy();
  // Başlık şablonu PRD 6.3: "... | Movieholix"
  await expect(page).toHaveTitle(/Movieholix/);
});

test("keşfet listeleniyor ve en az bir koleksiyon film içeriyor", async ({
  page,
}) => {
  await page.goto("/tr/explore");
  const hrefs = await page
    .locator('a[href^="/tr/explore/"]')
    .evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""),
    );
  expect(hrefs.length, "/explore'da hiç koleksiyon yok").toBeGreaterThan(0);

  // Hangi koleksiyonun dolu olduğu katalog moduna göre değişiyor (fixture'da 40,
  // gerçek TMDB'de 200+ film). Testin amacı keşfet -> koleksiyon -> film yolunun
  // çalıştığını göstermek, belirli bir koleksiyonun içeriğini sabitlemek değil.
  let withFilms: string | null = null;
  for (const href of hrefs) {
    await page.goto(href);
    await expect(page.locator("h1").first()).toBeVisible();
    if ((await page.locator('a[href^="/tr/films/"]').count()) > 0) {
      withFilms = href;
      break;
    }
  }

  expect(
    withFilms,
    "hiçbir koleksiyonda film yok — /explore'un boş kalması bilinen bir regresyondu",
  ).not.toBeNull();
});

test("dil değiştirme: aynı sayfanın tr ve en sürümleri farklı metin veriyor", async ({
  page,
}) => {
  await page.goto("/tr/explore");
  const trHeading = (await page.locator("h1").first().textContent())?.trim();

  await page.goto("/en/explore");
  const enHeading = (await page.locator("h1").first().textContent())?.trim();

  expect(trHeading).toBeTruthy();
  expect(enHeading).toBeTruthy();
  expect(trHeading).not.toBe(enHeading);
});

test("html lang özniteliği locale ile eşleşiyor", async ({ page }) => {
  await page.goto("/tr");
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("bilinmeyen film ve koleksiyon slug'ları 404 dönüyor", async ({
  request,
}) => {
  for (const path of [
    "/tr/films/boyle-bir-film-yok-999999",
    "/tr/explore/boyle-bir-koleksiyon-yok",
    "/tr/people/boyle-biri-yok-999999",
  ]) {
    const res = await request.get(path);
    expect(res.status(), `${path} 404 dönmeli`).toBe(404);
  }
});

test("geçersiz locale 404 dönüyor", async ({ request }) => {
  const res = await request.get("/de/films");
  expect(res.status()).toBe(404);
});
