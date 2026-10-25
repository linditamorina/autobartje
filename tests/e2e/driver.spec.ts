import { expect, test, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { ensureStaff, login } from "./helpers";

const DRIVER_EMAIL = "driton@example.com";
const DRIVER_PASSWORD = "driver-demo-password";
const OFFICE_EMAIL = "e2e-dispatcher@example.com";
const OFFICE_PASSWORD = "e2e-dispatcher-password";
const ANGLES = ["FRONT", "REAR", "LEFT", "RIGHT"];
// 1×1 PNG; the app turns it into a JPEG before upload
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

/** A confirmed order assigned to the demo driver, and an office user without 2FA to check the result. */
async function setup() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const driverUser = await db.user.update({ where: { email: DRIVER_EMAIL }, data: { failedLogins: 0, lockedUntil: null }, include: { driver: true } });
    const truck = await db.truck.findUniqueOrThrow({ where: { plate: "03-789-AB" } });
    await ensureStaff("DISPATCHER", OFFICE_EMAIL, OFFICE_PASSWORD);
    const stamp = String(Date.now()).slice(-6);
    const customer = await db.customer.create({ data: { fullName: `E2E Driver Customer ${stamp}`, phone: `+38349${stamp}` } });
    const order = await db.order.create({
      data: {
        number: `E2E-D-${stamp}`,
        status: "CONFIRMED",
        service: "DOMESTIC_TRANSPORT",
        channel: "PHONE",
        customer: { connect: { id: customer.id } },
        pickupAddress: "Rruga Mbretëresha Teutë, Pejë",
        pickupLat: 42.6593,
        pickupLng: 20.2887,
        dropoffAddress: "Prishtinë",
        options: { winch: true },
        finalCents: 9000,
        statusEvents: { create: { to: "CONFIRMED" } },
        vehicle: { create: { type: "CAR" as const, make: "VW", model: "Golf", plate: `01-${stamp}`, isDrivable: false } },
      },
    });
    const start = new Date();
    await db.assignment.create({ data: { orderId: order.id, driverId: driverUser.driver!.id, truckId: truck.id, plannedStart: start, plannedEnd: new Date(start.getTime() + 3600_000) } });
    return order;
  } finally {
    await db.$disconnect();
  }
}

async function takePhotos(page: Page) {
  for (const angle of ANGLES) {
    await page.locator(`input[data-angle="${angle}"]`).setInputFiles({ name: `${angle}.png`, mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("img", { name: { FRONT: "Front", REAR: "Rear", LEFT: "Left side", RIGHT: "Right side" }[angle] })).toBeVisible();
  }
}

async function noSideScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
}

// The driver app is for phones: run it once, at 360px.
test("driver does a job from start to delivery and the office sees the record", async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== "mobile-360", "driver flow runs once, on a phone");
  test.setTimeout(120_000);
  const order = await setup();

  const context = await browser.newContext({ baseURL, viewport: { width: 360, height: 740 }, hasTouch: true });
  await context.addCookies([{ name: "ab_admin_locale", value: "en", url: baseURL! }]);
  const page = await context.newPage();

  // Drivers land in their app after login
  await login(page, DRIVER_EMAIL, DRIVER_PASSWORD);
  await expect(page).toHaveURL(/\/driver$/);
  await page.getByRole("link", { name: new RegExp(order.number) }).click();
  await expect(page.getByRole("heading", { name: order.number })).toBeVisible();
  await expect(page.getByText("Winch needed")).toBeVisible();
  await noSideScroll(page);

  await page.getByRole("button", { name: "Start driving" }).click();
  // Loading needs the pickup photos first
  await expect(page.getByRole("button", { name: "Vehicle loaded" })).toBeDisabled();
  await page.getByRole("link", { name: "Take pickup photos first" }).click();
  await expect(page.getByText("4 required photos missing")).toBeVisible();
  await noSideScroll(page);
  await takePhotos(page);
  await expect(page.getByText("4 photos taken")).toBeVisible();
  await page.getByLabel("Odometer (km)").fill("123456");
  await page.getByRole("button", { name: "Save pickup inspection" }).click();
  await expect(page.getByRole("heading", { name: order.number })).toBeVisible();

  await page.getByRole("button", { name: "Vehicle loaded" }).click();
  await page.getByRole("button", { name: "On the way to drop-off" }).click();
  await expect(page.getByRole("button", { name: "Vehicle delivered" })).toBeDisabled();

  // Delivery: photos, then the customer signs
  await page.getByRole("link", { name: "Take delivery photos and signature" }).click();
  await takePhotos(page);
  await page.getByLabel("Name of the person signing").fill("Blerim Gashi");
  const pad = page.getByRole("img", { name: "Sign here" });
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 90, { steps: 8 });
  await page.mouse.move(box.x + 220, box.y + 50, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText("Signed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save and confirm delivery" }).click();
  await expect(page.getByRole("heading", { name: order.number })).toBeVisible();
  await page.getByRole("button", { name: "Vehicle delivered" }).click();
  // The last step is done: no next button, status shows delivered
  await expect(page.getByRole("button", { name: "Vehicle delivered" })).toHaveCount(0);
  await expect(page.getByText("Delivered", { exact: true })).toBeVisible();

  // Cash from the customer
  page.once("dialog", (d) => d.accept());
  await page.getByLabel("Amount (€)").fill("90");
  await page.getByRole("button", { name: "Record cash" }).click();
  await expect(page.getByText("Cash recorded.")).toBeVisible();
  await expect(page.getByText(/Cash received: €\s?90\.00|Cash received: 90\.00\s?€/)).toBeVisible();

  // The customer's tracking page shows the delivery
  await page.goto(`/en/track/${order.trackingToken}`);
  await expect(page.getByRole("heading", { name: `Order ${order.number}` })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toHaveCount(0);
  await expect(page.getByText("Driver", { exact: true })).toBeVisible();
  await noSideScroll(page);
  await context.close();

  // Photos are private
  const anon = await browser.newContext({ baseURL });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const photo = await db.inspectionPhoto.findFirstOrThrow({ where: { inspection: { orderId: order.id } } });
  await db.$disconnect();
  expect((await anon.request.get(`/api/files/inspection/${photo.id}`)).status()).toBeGreaterThanOrEqual(401);
  await anon.close();

  // The office sees both inspections, the signature and the cash
  const office = await browser.newContext({ baseURL });
  await office.addCookies([{ name: "ab_admin_locale", value: "en", url: baseURL! }]);
  const op = await office.newPage();
  await login(op, OFFICE_EMAIL, OFFICE_PASSWORD);
  await expect(op).toHaveURL(/\/admin$/);
  await op.goto(`/admin/orders/${order.id}`);
  await expect(op.getByRole("heading", { name: "Pickup inspection" })).toBeVisible();
  await expect(op.getByRole("heading", { name: "Delivery inspection" })).toBeVisible();
  await expect(op.getByRole("img", { name: "Front" })).toHaveCount(2);
  await expect(op.getByText("Signed by Blerim Gashi", { exact: false })).toBeVisible();
  await expect(op.getByRole("heading", { name: "Payments received" })).toBeVisible();
  const res = await op.request.get(`/api/files/inspection/${photo.id}`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^image\//);
  await office.close();
});
