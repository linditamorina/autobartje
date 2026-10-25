import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { testDb } from "./helpers";

const SECRET = process.env.WHATSAPP_APP_SECRET ?? "";
const VERIFY = process.env.WHATSAPP_VERIFY_TOKEN ?? "";

test("WhatsApp webhook: verification, signature, SMS fallback for undeliverable messages", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "runs once");
  test.skip(!SECRET || !VERIFY, "needs WHATSAPP_APP_SECRET and WHATSAPP_VERIFY_TOKEN (CI sets test values)");

  // Meta's one-time check of the callback URL
  const ok = await request.get(`/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=12345`);
  expect(await ok.text()).toBe("12345");
  expect((await request.get(`/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1`)).status()).toBe(403);

  const db = testDb();
  const wamid = `wamid.e2e${Date.now()}`;
  const row = await db.notificationOutbox.create({
    data: { event: "driver_en_route", channel: "WHATSAPP", to: "+38344999888", payload: { orderNumber: "P-E2E", locale: "en" }, status: "SENT", providerId: wamid, sentAt: new Date() },
  });
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { statuses: [{ id: wamid, status: "failed", errors: [{ code: 131026, title: "Message undeliverable" }] }] } }] }] });
  const sig = `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;
  const headers = { "content-type": "application/json", "x-hub-signature-256": sig };

  expect((await request.post("/api/whatsapp/webhook", { data: body, headers: { ...headers, "x-hub-signature-256": "sha256=00" } })).status()).toBe(401);
  expect((await request.post("/api/whatsapp/webhook", { data: body, headers })).status()).toBe(200);
  // A repeated delivery of the same status does not send a second SMS
  expect((await request.post("/api/whatsapp/webhook", { data: body, headers })).status()).toBe(200);

  expect((await db.notificationOutbox.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("FAILED");
  const sms = await db.notificationOutbox.findMany({ where: { to: "+38344999888", channel: "SMS", createdAt: { gte: row.createdAt } } });
  expect(sms).toHaveLength(1);
  expect(sms[0].event).toBe("driver_en_route");
  await db.$disconnect();
});
