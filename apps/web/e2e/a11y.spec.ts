import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * PRD 18.1: "Erişilebilirlik: token kontrast testleri, web'de axe".
 * Token kontrastı packages/tokens/src/contrast.test.ts'te birim testle
 * doğrulanıyor; burada gerçek sayfalar taranıyor.
 *
 * WCAG 2.1 A + AA kuralları (PRD 15.7 AA kontrast zorunluluğu).
 */
const PAGES: ReadonlyArray<readonly [string, string]> = [
  ["landing", "/tr"],
  ["film listesi", "/tr/films"],
  ["keşfet", "/tr/explore"],
  ["popüler", "/tr/popular"],
  ["kişiler", "/tr/people"],
  ["indirme", "/tr/download"],
  ["gizlilik", "/tr/privacy"],
];

for (const [name, path] of PAGES) {
  test(`${name} sayfası WCAG 2.1 AA ihlali içermiyor`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    // İhlal varsa mesajda kural ve etkilenen seçici görünsün — çıplak sayı
    // hata ayıklamak için yetersiz.
    const summary = results.violations.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 5)
          .join("\n    ")}`,
    );
    expect(summary, `${path} erişilebilirlik ihlalleri`).toEqual([]);
  });
}

test("film detay sayfası WCAG 2.1 AA ihlali içermiyor", async ({ page }) => {
  await page.goto("/tr/films");
  await page.locator('a[href^="/tr/films/"]').first().click();
  await page.waitForURL(/\/tr\/films\/.+/);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}`,
  );
  expect(summary, "film detayı erişilebilirlik ihlalleri").toEqual([]);
});
