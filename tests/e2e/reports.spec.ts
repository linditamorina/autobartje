import { expect, test } from "@playwright/test";
import { ensureStaff, login, testDb } from "./helpers";

const ACCOUNTANT_EMAIL = "e2e-accountant@example.com";
const ACCOUNTANT_PASSWORD = "e2e-accountant-password";
// A month no other test or seed writes to, so the numbers are exact.
const PERIOD = "period=custom&from=2020-02-01&to=2020-02-29";

async function setup() {
  const db = testDb();
  try {
    await ensureStaff("ACCOUNTANT", ACCOUNTANT_EMAIL, ACCOUNTANT_PASSWORD);
    await db.order.deleteMany({ where: { number: { startsWith: "E2E-R-" } } });
    const customer = await db.customer.create({ data: { fullName: "E2E Reports Customer", phone: `+38345${String(Date.now()).slice(-6)}` } });
    const base = { channel: "PHONE" as const, customer: { connect: { id: customer.id } }, pickupAddress: "Pejë", options: {} };
    const created = new Date("2020-02-10T09:00:00Z"); // 10:00 in Kosovo, a Monday
    await db.order.create({
      data: {
        ...base,
        number: "E2E-R-1",
        status: "DELIVERED",
        service: "EMERGENCY_TOWING",
        priority: "URGENT",
        isAsap: true,
        finalCents: 12_000,
        distanceKm: 12,
        createdAt: created,
        deliveredAt: new Date(created.getTime() + 60 * 60_000),
        statusEvents: {
          create: [
            { to: "RECEIVED", createdAt: created },
            { to: "CONFIRMED", createdAt: new Date(created.getTime() + 3 * 60_000) },
            { to: "PICKED_UP", createdAt: new Date(created.getTime() + 25 * 60_000) },
            { to: "DELIVERED", createdAt: new Date(created.getTime() + 60 * 60_000) },
          ],
        },
      },
    });
    await db.order.create({ data: { ...base, number: "E2E-R-2", status: "CANCELLED", service: "DOMESTIC_TRANSPORT", estimatedCents: 9000, createdAt: new Date("2020-02-11T15:00:00Z"), leadSource: "google_ads" } });
  } finally {
    await db.$disconnect();
  }
}

test("the accountant sees the period's numbers and downloads the orders", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "runs once");
  await setup();
  await page.context().addCookies([{ name: "ab_admin_locale", value: "en", url: info.project.use.baseURL! }]);
  await login(page, ACCOUNTANT_EMAIL, ACCOUNTANT_PASSWORD);
  await page.getByRole("link", { name: "Reports" }).first().click();
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByRole("link", { name: "This month" })).toHaveAttribute("aria-current", "page");

  await page.goto(`/admin/reports?${PERIOD}`);
  const kpis = page.getByTestId("kpis");
  await expect(kpis).toContainText("Orders2");
  await expect(kpis).toContainText("1 finished · 0 from business customers");
  await expect(kpis).toContainText("Value of finished orders€120.00");
  await expect(kpis).toContainText("Cancelled50%");
  await expect(kpis).toContainText("Arrival time, urgent call-outs25 min");
  await expect(kpis).toContainText("Time to confirm3 min");
  await expect(page.getByTestId("by-service").getByRole("row", { name: /Towing/ })).toContainText("11€120.00");
  await expect(page.getByTestId("by-source").getByRole("row", { name: /google_ads/ })).toContainText("10€0.00");
  await expect(page.getByText("Busiest: Mon at 10:00 (1 order)")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Orders (CSV)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("porosite-2020-02-01_2020-02-29.csv");
  const text = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
  expect(text).toContain("E2E-R-1;2020-02-10 10:00;DELIVERED;EMERGENCY_TOWING;PHONE");
  expect(text.trim().split("\r\n")).toHaveLength(3);
});
