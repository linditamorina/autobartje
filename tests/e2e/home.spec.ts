import { expect, test } from "@playwright/test";

test.describe("home page", () => {
  test("shows both paths and has no horizontal scroll", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /emergency now/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /get instant price/i })).toHaveAttribute("href", "/en/quote");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test("defaults to Albanian without a locale prefix", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ locale: "sq-XK", baseURL });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "sq");
    await context.close();
  });

  test("mobile action bar has call, WhatsApp and location", async ({ page, isMobile }) => {
    test.skip(!isMobile, "bar is mobile only");
    await page.goto("/en");
    const bar = page.getByRole("navigation", { name: "Quick actions" });
    await expect(bar.getByRole("link", { name: /call/i })).toHaveAttribute("href", /^tel:\+/);
    await expect(bar.getByRole("link", { name: /whatsapp/i })).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+\?text=/);
    await expect(bar.getByRole("button", { name: /send my location/i })).toBeVisible();
  });

  test("cookie banner offers reject as prominently as accept and remembers the choice", async ({ page }) => {
    await page.goto("/en");
    const banner = page.getByRole("dialog", { name: "Cookies" });
    const reject = banner.getByRole("button", { name: "Reject" });
    const accept = banner.getByRole("button", { name: "Accept all" });
    const [r, a] = await Promise.all([reject.boundingBox(), accept.boundingBox()]);
    expect(Math.abs(r!.height - a!.height)).toBeLessThan(1);
    expect(Math.abs(r!.width - a!.width)).toBeLessThan(2);
    await reject.click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByRole("dialog", { name: "Cookies" })).toBeHidden();
  });

  test("serves robots, sitemap and manifest", async ({ request }) => {
    expect((await request.get("/robots.txt")).ok()).toBe(true);
    const sitemap = await request.get("/sitemap.xml");
    expect(await sitemap.text()).toContain("hreflang");
    expect((await request.get("/manifest.webmanifest")).ok()).toBe(true);
  });
});
