import { expect, test, type Page } from "@playwright/test";
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

// One owner account and TOTP codes that cannot be replayed: run once, on desktop, in one browser session.
test.describe.serial("admin", () => {
  let page: Page;

  test.beforeAll(async ({ browser, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "admin flow runs once, on desktop");
    await resetOwner();
    const context = await browser.newContext({ baseURL });
    await context.addCookies([{ name: "ab_admin_locale", value: "en", url: baseURL! }]);
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await page?.context().close();
  });

test("owner logs in, sets up 2FA, takes a phone order and edits the brand", async () => {

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

test("dispatcher view: add a truck, assign it with clash checks", async () => {
  test.setTimeout(60_000);
  // 1–2 years ahead (a different day each run): no demo jobs there and the demo driver's licence is still valid
  const day = new Date(Date.now() + (400 + (Math.floor(Date.now() / 1000) % 300)) * 86_400_000).toISOString().slice(0, 10);
  const start = `${day}T09:00`;
  const plate = `E2E-${String(Date.now()).slice(-6)}`;

  // New truck whose insurance runs out the day before the job
  const dayBefore = new Date(Date.parse(`${day}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  await page.goto("/admin/fleet/trucks/new");
  await page.getByLabel("Plate").fill(plate);
  await page.getByLabel("Insurance valid until").fill(dayBefore);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/admin\/fleet$/);
  await expect(page.getByRole("link", { name: plate.toUpperCase() })).toBeVisible();

  // A fresh order to assign
  await page.goto("/admin/orders/new");
  await page.getByLabel("Pickup address").fill("Rruga e Prizrenit, Pejë");
  await page.getByLabel("Customer name").fill("E2E Dispatch Customer");
  await page.getByLabel("Phone", { exact: true }).fill(`+38345${String(Date.now()).slice(-6)}`);
  await page.getByRole("button", { name: "Create order" }).click();
  await expect(page.getByRole("heading", { name: /^Order P-/ })).toBeVisible();
  const orderUrl = page.url();

  const assignPanel = page.locator("section", { has: page.getByRole("heading", { name: "Driver and truck" }) });
  const fillAssign = async () => {
    await assignPanel.getByLabel("Driver").selectOption({ label: "Arben K." });
    const truckValue = await assignPanel.getByLabel("Truck").locator("option", { hasText: plate }).getAttribute("value");
    await assignPanel.getByLabel("Truck").selectOption(truckValue!);
    await assignPanel.getByLabel("Start").fill(start);
    await assignPanel.getByLabel("Duration (minutes)").fill("120");
    await assignPanel.getByRole("button", { name: "Assign", exact: true }).click();
  };
  await expect(assignPanel.getByText("No driver assigned yet.")).toBeVisible();
  await fillAssign();
  // Blocked, and the form keeps what was typed
  await expect(assignPanel.getByText(/insurance expires before the job ends/)).toBeVisible();
  await expect(assignPanel.getByLabel("Start")).toHaveValue(start);

  // Renew the insurance in Fleet, then assign again
  await page.goto("/admin/fleet");
  await page.getByRole("link", { name: plate }).click();
  await page.getByLabel("Insurance valid until").fill(`${Number(day.slice(0, 4)) + 1}-12-31`);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/admin\/fleet$/);

  await page.goto(orderUrl);
  await fillAssign();
  await expect(assignPanel.getByText("Assigned. The driver gets an SMS.")).toBeVisible();
  await page.reload();
  await expect(assignPanel.getByText("Arben K.").first()).toBeVisible();

  // The dispatch board shows it on that day
  await page.goto(`/admin/dispatch?date=${day}`);
  await expect(page.getByText(plate, { exact: true })).toBeVisible();
  await expect(page.getByTitle(/Arben K\./).first()).toBeVisible();
});

test("owner edits a price and checks it in the price tester", async () => {
  await page.goto("/admin/pricing?tab=test");
  await page.getByLabel("Service").selectOption({ label: "Towing" });
  await page.getByLabel("Distance (km)").fill("10");
  await page.getByLabel("Pickup time (empty = now)").fill("2030-03-06T10:00"); // a Wednesday, daytime
  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page.getByTestId("sim-result")).toContainText("Total");
  const before = await page.getByTestId("sim-result").locator("tr").last().textContent();

  await page.goto("/admin/pricing?tab=rules");
  const row = page.locator("form", { has: page.locator('input[name="name"][value="Emergency call-out"]') });
  const amount = row.locator('input[name="amount"]');
  const original = await amount.inputValue();
  await amount.fill(String(Number(original) + 10));
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("Saved.")).toBeVisible();

  await page.goto("/admin/pricing?tab=test");
  await page.getByLabel("Service").selectOption({ label: "Towing" });
  await page.getByLabel("Distance (km)").fill("10");
  await page.getByLabel("Pickup time (empty = now)").fill("2030-03-06T10:00");
  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page.getByTestId("sim-result").locator("tr").last()).not.toHaveText(before!);

  // Put the price back
  await page.goto("/admin/pricing?tab=rules");
  await row.locator('input[name="amount"]').fill(original);
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("Saved.")).toBeVisible();
});

test("owner adds a dispatcher account", async () => {
  const email = `dispatcher-${Date.now()}@example.com`;
  await page.goto("/admin");
  await page.getByRole("link", { name: "Users" }).first().click();
  await expect(page.getByRole("heading", { name: "Staff accounts" })).toBeVisible();
  await page.goto("/admin/users/new");
  await page.getByLabel("Full name").fill("E2E Dispatcher");
  await page.getByLabel("Email (login)").fill(email);
  await page.getByLabel("Role").selectOption("DISPATCHER");
  await page.getByLabel("Starting password").fill("short");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Please check the highlighted fields.")).toBeVisible();
  await expect(page.getByLabel("Email (login)")).toHaveValue(email);
  await page.getByLabel("Starting password").fill("dispatcher-password-123");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "E2E Dispatcher" })).toBeVisible();
  await page.goto("/admin/users");
  await expect(page.getByText(email)).toBeVisible();
});

test("admin pages fit a 360px phone", async () => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const path of ["/admin", "/admin/orders", "/admin/orders?view=board", "/admin/dispatch", "/admin/fleet", "/admin/pricing", "/admin/pricing?tab=routes", "/admin/users", "/admin/settings", "/admin/audit"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
  }
});
});
