import { expect, test } from "@playwright/test";
import { generate } from "otplib";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const EMAIL = (process.env.SEED_ADMIN_EMAIL ?? "owner@example.com").toLowerCase();
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "change-me-now-please";

/** Fresh start for the seeded owner: no authenticator yet, no lockout. */
async function resetOwner() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  await db.user.update({
    where: { email: EMAIL },
    data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, failedLogins: 0, lockedUntil: null },
  });
  await db.$disconnect();
}

test("owner logs in, sets up 2FA, takes a phone order and edits the brand", async ({ page, context, baseURL }, info) => {
  // One owner account and TOTP codes that cannot be replayed: run once, on desktop.
  test.skip(info.project.name !== "desktop", "admin flow runs once, on desktop");
  await resetOwner();
  await context.addCookies([{ name: "ab_admin_locale", value: "en", url: baseURL! }]);

  // Protected pages send you to the login
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/login/);

  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();

  // Owner role requires 2FA: first login forces setup
  await expect(page).toHaveURL(/\/admin\/2fa\/setup/);
  const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
  await page.getByLabel("Code").fill(await generate({ secret }));
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  // Manual phone order
  await page.goto("/admin/orders/new");
  await page.getByLabel("Pickup address").fill("Rruga Mbretëresha Teuta, Pejë");
  await page.getByLabel("Delivery address").fill("Prishtinë");
  await page.getByLabel("Urgent").check();
  await page.getByLabel("Customer name").fill("E2E Phone Customer");
  await page.getByLabel("Phone", { exact: true }).fill(`+38349${String(Date.now()).slice(-6)}`);
  await page.getByLabel("Plate").fill("01-e2e-01");
  await page.getByRole("button", { name: "Create order" }).click();
  await expect(page.getByRole("heading", { name: /^Order P-\d{4}-\d{5}$/ })).toBeVisible();
  await expect(page.getByText("01-E2E-01")).toBeVisible();

  // Confirming needs a final price
  const statusPanel = page.locator("section", { has: page.getByRole("heading", { name: "Change status" }) });
  await statusPanel.getByRole("button", { name: "Move to: Confirmed" }).click();
  await expect(statusPanel.getByText("Set the final price before confirming.")).toBeVisible();
  await statusPanel.getByLabel("Final price (EUR, incl. VAT)").fill("45");
  await statusPanel.getByRole("button", { name: "Move to: Confirmed" }).click();
  await expect(page.getByRole("button", { name: "Move to: Driver en route" })).toBeVisible();

  // Brand name is editable and shows on the public site
  const brand = `autobartje e2e ${Date.now() % 1000}`;
  await page.goto("/admin/settings");
  const nameField = page.getByLabel("Brand name");
  const original = await nameField.inputValue();
  await nameField.fill(brand);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();

  await page.goto("/en");
  await expect(page.getByRole("banner").getByText(brand)).toBeVisible();

  await page.goto("/admin/audit");
  await expect(page.getByText("settings.updated").first()).toBeVisible();
  await expect(page.getByText("order.created").first()).toBeVisible();

  await page.goto("/admin/settings");
  await page.getByLabel("Brand name").fill(original);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
});
