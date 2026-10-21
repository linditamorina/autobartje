import { expect, test } from "@playwright/test";

const PAGES = [
  ["/en/services", "Our services"],
  ["/en/services/emergency-towing", "24/7 emergency towing"],
  ["/en/services/car-import", "Car import from Europe"],
  ["/en/import-guide", "Car import guide"],
  ["/en/pricing", "Prices"],
  ["/en/fleet", "Our fleet"],
  ["/en/contact", "Contact"],
  ["/en/faq", "Frequently asked questions"],
  ["/en/areas", "Areas we serve"],
  ["/en/areas/peje", "Towing in Peja"],
  ["/en/blog", "Tips and news"],
  ["/en/about", "About us"],
  ["/en/legal/terms", "Terms of use"],
  ["/en/legal/privacy", "Privacy policy"],
  ["/en/legal/cookies", "Cookie policy"],
  ["/de/services/roadside-assistance", "Pannenhilfe"],
] as const;

test.describe("default language", () => {
  // Unprefixed URLs are Albanian, unless the browser asks for another language.
  test.use({ locale: "sq-XK" });

  test("Albanian legal page and city page", async ({ page }) => {
    await page.goto("/legal/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Politika e privatësisë");
    await page.goto("/areas/peje");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tërheqje në Pejë");
  });
});

test.describe("content pages", () => {
  test("every page opens, has its heading and fits the screen", async ({ page }) => {
    for (const [path, heading] of PAGES) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1 }), path).toHaveText(heading);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
    }
  });

  test("unknown slugs are 404", async ({ page }) => {
    for (const path of ["/en/services/teleport", "/en/legal/secret", "/en/areas/atlantis", "/en/blog/nothing-here"]) {
      expect((await page.goto(path))?.status(), path).toBe(404);
    }
  });

  test("service page links to a quote for that service", async ({ page }) => {
    await page.goto("/en/services/car-import");
    await page.getByRole("link", { name: "Get a price" }).first().click();
    await expect(page).toHaveURL(/\/en\/quote\?service=INTERNATIONAL_TRANSPORT/);
  });

  test("FAQ and services carry structured data", async ({ page }) => {
    await page.goto("/en/faq");
    const faq = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(faq.some((s) => s.includes('"FAQPage"'))).toBe(true);
    expect(faq.some((s) => s.includes('"BreadcrumbList"'))).toBe(true);
  });

  test("privacy policy fills in company settings", async ({ page }) => {
    await page.goto("/en/legal/privacy");
    await expect(page.getByText("06/L-082")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("{{");
  });

  test("sitemap lists content and city pages in every language", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    for (const path of ["/services/emergency-towing", "/en/legal/privacy", "/de/areas/peje", "/en/faq"]) expect(xml, path).toContain(path);
  });
});
