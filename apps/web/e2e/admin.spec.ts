import { expect, test } from "@playwright/test";

/**
 * PRD 14.1 "Admin paneli (rol korumalı)". Panel ekip içi; oturumsuz hiçbir
 * sayfası açılmamalı. Bu testler yetkilendirmenin kazara kaldırılmasına karşı
 * regresyon koruması — `(protected)` route group'u yanlışlıkla bozulursa
 * burada yakalanır.
 */
const PROTECTED = [
  "/admin",
  "/admin/reports",
  "/admin/config",
  "/admin/collections",
  "/admin/testimonials",
  "/admin/users/00000000-0000-0000-0000-000000000000",
  "/admin/reports/00000000-0000-0000-0000-000000000000",
];

for (const path of PROTECTED) {
  test(`${path} oturumsuz erişilemiyor`, async ({ request }) => {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), `${path} yönlendirmeli`).toBe(307);
    expect(res.headers()["location"]).toContain("/admin/sign-in");
  });
}

test("admin giriş sayfası herkese açık", async ({ page }) => {
  await page.goto("/admin/sign-in");
  await expect(page.locator("h1, h2").first()).toBeVisible();
});

test("admin paneli sitemap'lerde ve robots'ta yer almıyor", async ({
  request,
}) => {
  for (const path of [
    "/sitemap.xml",
    "/films/sitemap.xml",
    "/people/sitemap.xml",
    "/collections/sitemap.xml",
  ]) {
    const body = await (await request.get(path)).text();
    expect(body, `${path} admin linki içeriyor`).not.toContain("/admin");
  }
});

test("revalidate API'si oturumsuz yazma kabul etmiyor", async ({ request }) => {
  // PRD 10.2 revalidate-web: secret'sız çağrı ISR önbelleğini temizleyebilmemeli.
  const res = await request.post("/api/revalidate", {
    data: { entity: "catalog" },
  });
  expect([401, 503]).toContain(res.status());
});
