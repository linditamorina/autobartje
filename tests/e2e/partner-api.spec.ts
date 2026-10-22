import { createHmac } from "node:crypto";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { login, testDb } from "./helpers";
import { newApiKey } from "../../src/server/partner/signing";

// Keys and webhooks are for Owner and Admin, who need 2FA. A test role with the same rights and no 2FA keeps this test about the API.
const ADMIN_EMAIL = "e2e-api-admin@example.com";
const ADMIN_PASSWORD = "e2e-api-admin-password";

type Received = { headers: IncomingHttpHeaders; body: string };

async function setup() {
  const db = testDb();
  try {
    const role = await db.role.upsert({
      where: { key: "E2E_API_ADMIN" },
      update: {},
      create: { key: "E2E_API_ADMIN", name: "E2E API admin", permissions: ["orders.read", "orders.update", "customers.read", "customers.manage", "settings.manage"] },
    });
    await db.user.upsert({ where: { email: ADMIN_EMAIL }, update: { failedLogins: 0, lockedUntil: null }, create: { email: ADMIN_EMAIL, name: "E2E API admin", roleId: role.id, passwordHash: await hash(ADMIN_PASSWORD) } });
    const stamp = String(Date.now()).slice(-6);
    const company = await db.company.create({ data: { name: `E2E Partner ${stamp}`, type: "INSURER", billingEmail: `claims-${stamp}@example.com` } });
    // A second company with its own key, to prove companies cannot see each other's orders
    const other = await db.company.create({ data: { name: `E2E Other ${stamp}`, type: "CAR_DEALER" } });
    const otherKey = newApiKey();
    await db.apiKey.create({ data: { companyId: other.id, name: "other", prefix: otherKey.prefix, secretHash: otherKey.hash } });
    return { company, otherKey: otherKey.key, stamp };
  } finally {
    await db.$disconnect();
  }
}

const job = {
  service: "DOMESTIC_TRANSPORT",
  pickup: { address: "Rruga Mbretëresha Teutë 12, Pejë", lat: 42.6593, lng: 20.2887 },
  dropoff: { address: "Prishtinë", lat: 42.6629, lng: 21.1655 },
  pickupAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
};

const auth = (key: string) => ({ authorization: `Bearer ${key}` });

async function waitFor(received: Received[], event: string) {
  await expect.poll(() => received.find((r) => JSON.parse(r.body).event === event), { timeout: 15_000 }).toBeTruthy();
  return received.find((r) => JSON.parse(r.body).event === event)!;
}

function verify(r: Received, secret: string) {
  const { t, v1 } = Object.fromEntries(String(r.headers["x-autobartje-signature"]).split(",").map((p) => p.split("=")));
  expect(v1).toBe(createHmac("sha256", secret).update(`${t}.${r.body}`).digest("hex"));
  expect(Math.abs(Date.now() / 1000 - Number(t))).toBeLessThan(300);
}

test("a partner prices, books and follows an order through the API, with signed webhooks", async ({ page, request }, info) => {
  test.skip(info.project.name !== "desktop", "runs once");
  test.setTimeout(90_000);
  const { company, otherKey, stamp } = await setup();

  // The partner's webhook receiver
  const received: Received[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received.push({ headers: req.headers, body });
      res.writeHead(204).end();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const hookUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;

  try {
    // The office creates a key and a webhook for the company
    await page.context().addCookies([{ name: "ab_admin_locale", value: "en", url: info.project.use.baseURL! }]);
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/admin/customers/${company.id}`);
    const panel = page.getByTestId("api-access");
    await panel.getByLabel("Name of the key").fill("Claims system");
    await panel.getByRole("button", { name: "Create key" }).click();
    const key = await panel.getByTestId("one-time-secret").inputValue();
    expect(key).toMatch(/^abk_[a-f0-9]{12}_/);

    // A local http address works only because the test server runs with WEBHOOK_ALLOW_PRIVATE=1 (unit tests cover the refusal)
    await panel.getByLabel("URL that receives order events").fill(hookUrl);
    await panel.getByRole("button", { name: "Add webhook" }).click();
    await expect(panel.getByTestId("one-time-secret").last()).toHaveValue(/^whsec_/);
    const secret = await panel.getByTestId("one-time-secret").last().inputValue();

    // Price a job
    const quote = await request.post("/api/v1/quotes", { headers: auth(key), data: job });
    expect(quote.status()).toBe(200);
    const q = (await quote.json()).data;
    expect(q.currency).toBe("EUR");
    expect(q.distanceKm).toBeGreaterThan(70);

    // Book: without a key, with missing fields, then properly (twice with the same Idempotency-Key)
    expect((await request.post("/api/v1/orders", { data: job })).status()).toBe(401);
    const bad = await request.post("/api/v1/orders", { headers: auth(key), data: { ...job, vehicle: { make: "VW", model: "Golf" } } });
    expect(bad.status()).toBe(422);
    expect((await bad.json()).error.issues.map((i: { path: string }) => i.path)).toContain("contact");

    const body = { ...job, vehicle: { make: "VW", model: "Golf", plate: "01-234-AB" }, contact: { name: "Arta Krasniqi", phone: "044 123 456" }, reference: `CLAIM-${stamp}` };
    const headers = { ...auth(key), "idempotency-key": `claim-${stamp}-transport` };
    const created = await request.post("/api/v1/orders", { headers, data: body });
    expect(created.status()).toBe(201);
    const order = (await created.json()).data;
    expect(order).toMatchObject({ status: "RECEIVED", reference: `CLAIM-${stamp}`, service: "DOMESTIC_TRANSPORT", vehicle: { make: "VW", plate: "01-234-AB" } });
    expect(order.trackingUrl).toMatch(/\/track\/[a-f0-9]{64}$/);
    const again = await request.post("/api/v1/orders", { headers, data: body });
    expect(again.status()).toBe(200);
    expect(again.headers()["idempotent-replayed"]).toBe("true");
    expect((await again.json()).data.number).toBe(order.number);

    // Follow it
    const one = await request.get(`/api/v1/orders/${order.number}`, { headers: auth(key) });
    expect((await one.json()).data.events).toEqual([expect.objectContaining({ status: "RECEIVED" })]);
    const list = await (await request.get(`/api/v1/orders?reference=CLAIM-${stamp}`, { headers: auth(key) })).json();
    expect(list.data.map((o: { number: string }) => o.number)).toEqual([order.number]);
    // Another company's key does not see it
    expect((await request.get(`/api/v1/orders/${order.number}`, { headers: auth(otherKey) })).status()).toBe(404);

    // Webhook: order.created, signed
    const createdHook = await waitFor(received, "order.created");
    verify(createdHook, secret);
    expect(JSON.parse(createdHook.body).data).toEqual({ number: order.number, status: "RECEIVED", reference: `CLAIM-${stamp}` });

    // The office confirms the order: the partner hears about it and sees the price
    await page.goto("/admin/orders");
    await page.getByRole("link", { name: order.number }).first().click();
    const statusPanel = page.locator("section", { has: page.getByRole("heading", { name: "Change status" }) });
    await statusPanel.getByLabel("Final price (EUR, incl. VAT)").fill("95");
    await statusPanel.getByRole("button", { name: "Move to: Confirmed" }).click();
    const changed = await waitFor(received, "order.status_changed");
    verify(changed, secret);
    expect(JSON.parse(changed.body).data).toMatchObject({ number: order.number, status: "CONFIRMED", previousStatus: "RECEIVED" });
    expect((await (await request.get(`/api/v1/orders/${order.number}`, { headers: auth(key) })).json()).data.price.finalCents).toBe(9500);

    // The company page shows the deliveries; revoking the key locks the partner out
    await page.goto(`/admin/customers/${company.id}`);
    await expect(panel.getByTestId("deliveries")).toContainText("order.status_changed · delivered (HTTP 204)");
    page.once("dialog", (d) => d.accept());
    await panel.getByRole("button", { name: "Revoke" }).click();
    await expect(panel.getByText(/^Revoked/)).toBeVisible();
    expect((await request.get("/api/v1/orders", { headers: auth(key) })).status()).toBe(401);
  } finally {
    server.close();
  }
});

test("the API description and the developer page are public", async ({ request }: { request: APIRequestContext }, info) => {
  test.skip(info.project.name !== "desktop", "runs once");
  const spec = await (await request.get("/api/v1/openapi.json")).json();
  expect(spec.openapi).toBe("3.1.0");
  expect(Object.keys(spec.paths)).toEqual(["/quotes", "/orders", "/orders/{number}"]);
  const page = await request.get("/developers");
  expect(page.status()).toBe(200);
  expect(await page.text()).toContain("Partner API");
});
