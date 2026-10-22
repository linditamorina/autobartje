import { expect, test } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { ensureStaff, login, testDb } from "./helpers";

// A driver of its own, so this test never shares a moving job with the driver flow test.
const DRIVER_EMAIL = "e2e-gps-driver@example.com";
const DRIVER_PASSWORD = "e2e-gps-driver-password";
const OFFICE_EMAIL = "e2e-dispatcher@example.com";
const OFFICE_PASSWORD = "e2e-dispatcher-password";
// About 9 km east of the pickup in Pejë
const PHONE_AT = { latitude: 42.66, longitude: 20.4, accuracy: 15 };

async function setup() {
  const db = testDb();
  try {
    const role = await db.role.findUniqueOrThrow({ where: { key: "DRIVER" } });
    const user = await db.user.upsert({
      where: { email: DRIVER_EMAIL },
      update: { failedLogins: 0, lockedUntil: null },
      create: { email: DRIVER_EMAIL, name: "Gezim GPS", roleId: role.id, passwordHash: await hash(DRIVER_PASSWORD) },
    });
    const driver = await db.driver.upsert({
      where: { userId: user.id },
      update: { isActive: true, lastSeenAt: null },
      create: { userId: user.id, licenseCategory: "C", licenseExpires: new Date(Date.now() + 365 * 86_400_000) },
    });
    await db.assignment.updateMany({ where: { driverId: driver.id }, data: { isActive: false } });
    await ensureStaff("DISPATCHER", OFFICE_EMAIL, OFFICE_PASSWORD);
    const truck = await db.truck.findUniqueOrThrow({ where: { plate: "03-789-AB" } });
    const stamp = String(Date.now()).slice(-6);
    const customer = await db.customer.create({ data: { fullName: `E2E GPS Customer ${stamp}`, phone: `+38348${stamp}` } });
    const order = await db.order.create({
      data: {
        number: `E2E-G-${stamp}`,
        status: "DRIVER_EN_ROUTE",
        service: "DOMESTIC_TRANSPORT",
        channel: "PHONE",
        locale: "en",
        customer: { connect: { id: customer.id } },
        pickupAddress: "Rruga Mbretëresha Teutë, Pejë",
        pickupLat: 42.6593,
        pickupLng: 20.2887,
        dropoffAddress: "Prishtinë",
        dropoffLat: 42.6629,
        dropoffLng: 21.1655,
        options: {},
        statusEvents: { create: [{ to: "CONFIRMED" }, { to: "DRIVER_EN_ROUTE" }] },
      },
    });
    await db.assignment.create({ data: { orderId: order.id, driverId: driver.id, truckId: truck.id, plannedStart: new Date(), plannedEnd: new Date(Date.now() + 3600_000), startedAt: new Date() } });
    return order;
  } finally {
    await db.$disconnect();
  }
}

test("the driver's phone shows the truck on the office map and the customer's tracking page", async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== "mobile-360", "runs once");
  test.setTimeout(90_000);
  const order = await setup();

  // Driver: the app starts sharing as soon as a job is under way
  const phone = await browser.newContext({ baseURL, viewport: { width: 360, height: 740 }, hasTouch: true, geolocation: PHONE_AT, permissions: ["geolocation"] });
  await phone.addCookies([{ name: "ab_admin_locale", value: "en", url: baseURL! }]);
  const driverPage = await phone.newPage();
  const sent = driverPage.waitForResponse((r) => r.url().endsWith("/api/driver/location") && r.request().method() === "POST");
  await login(driverPage, DRIVER_EMAIL, DRIVER_PASSWORD);
  await expect(driverPage).toHaveURL(/\/driver$/);
  expect(await (await sent).json()).toEqual({ sharing: true, stored: true });
  await expect(driverPage.getByRole("status").filter({ hasText: "Location shared with the office" })).toBeVisible();

  // Office: the live map lists the job with the distance to the pickup
  const office = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
  await office.addCookies([{ name: "ab_admin_locale", value: "en", url: baseURL! }]);
  const officePage = await office.newPage();
  await login(officePage, OFFICE_EMAIL, OFFICE_PASSWORD);
  await officePage.goto("/admin/map");
  await expect(officePage.getByRole("heading", { name: "Live map" })).toBeVisible();
  const row = officePage.getByTestId("live-jobs").getByRole("listitem").filter({ hasText: order.number });
  await expect(row).toContainText("Gezim GPS");
  await expect(row).toContainText(/Seen .* · 9(\.\d)? km to go · about 15 min/);

  // The order page keeps the route driven
  await officePage.goto(`/admin/orders/${order.id}`);
  await expect(officePage.getByRole("heading", { name: "Route driven" })).toBeVisible();
  await expect(officePage.getByTestId("last-position")).toContainText("Last position");

  // Customer: the tracking page says how far away the truck is
  const customer = await browser.newContext({ baseURL, viewport: { width: 360, height: 740 } });
  const trackPage = await customer.newPage();
  await trackPage.goto(`/en/track/${order.trackingToken}`);
  await expect(trackPage.getByTestId("truck-live")).toContainText("About 9 km away, there in about 15 min");
  expect(await trackPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  // Once the job is finished nothing more is recorded, and the customer no longer sees the truck
  const db = testDb();
  try {
    await db.order.update({ where: { id: order.id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
  } finally {
    await db.$disconnect();
  }
  const after = await driverPage.request.post("/api/driver/location", { data: { lat: 42.66, lng: 20.5 } });
  expect(await after.json()).toEqual({ sharing: false, stored: false });
  await trackPage.reload();
  await expect(trackPage.getByRole("heading", { name: `Order ${order.number}` })).toBeVisible();
  await expect(trackPage.getByTestId("truck-live")).toHaveCount(0);

  await Promise.all([phone.close(), office.close(), customer.close()]);
});
