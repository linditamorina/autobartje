import { expect, test } from "@playwright/test";
import Stripe from "stripe";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

function signed(event: object) {
  const payload = JSON.stringify(event);
  return { data: payload, headers: { "content-type": "application/json", "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }) } };
}

const event = (type: string, object: object) => ({ id: `evt_${Date.now()}_${Math.random()}`, object: "event", type, api_version: null, created: Math.floor(Date.now() / 1000), livemode: false, pending_webhooks: 0, request: null, data: { object } });

test("online payment: pay button, webhook books it once, refund reopens it", async ({ page, request }, info) => {
  test.skip(info.project.name !== "desktop", "runs once");
  test.skip(!SECRET, "needs STRIPE_WEBHOOK_SECRET (CI sets a test value)");

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const stamp = String(Date.now()).slice(-6);
  const customer = await db.customer.create({ data: { fullName: `E2E Pay ${stamp}`, phone: `+38343${stamp}` } });
  const order = await db.order.create({
    data: {
      number: `E2E-P-${stamp}`, status: "CONFIRMED", service: "DOMESTIC_TRANSPORT", channel: "PHONE", customerId: customer.id,
      pickupAddress: "Pejë", dropoffAddress: "Prizren", options: {}, finalCents: 12000, locale: "en", statusEvents: { create: { to: "CONFIRMED" } },
    },
  });
  const track = `/en/track/${order.trackingToken}`;

  await page.goto(track);
  await expect(page.getByRole("button", { name: "Pay €120.00" })).toBeVisible();

  // Forged calls are refused
  expect((await request.post("/api/stripe/webhook", { data: "{}", headers: { "stripe-signature": "t=1,v1=bad" } })).status()).toBe(400);

  const pi = `pi_e2e_${stamp}`;
  const paid = event("checkout.session.completed", {
    id: `cs_e2e_${stamp}`, object: "checkout.session", payment_status: "paid", amount_total: 12000, currency: "eur", payment_intent: pi, metadata: { orderId: order.id, invoiceId: "" },
  });
  // Stripe may deliver the same event twice
  expect((await request.post("/api/stripe/webhook", signed(paid))).status()).toBe(200);
  expect((await request.post("/api/stripe/webhook", signed(paid))).status()).toBe(200);
  const payments = await db.payment.findMany({ where: { orderId: order.id } });
  expect(payments).toHaveLength(1);
  expect(payments[0]).toMatchObject({ method: "CARD", status: "SUCCEEDED", amountCents: 12000, stripePaymentIntentId: pi });
  expect(await db.notificationOutbox.count({ where: { orderId: order.id, event: "payment_received" } })).toBe(1);

  await page.goto(`${track}?paid=1`);
  await expect(page.getByText("Thank you, we received your payment.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pay / })).toHaveCount(0);

  // A full refund in Stripe puts the amount back as due
  const refund = event("charge.refunded", { id: `ch_e2e_${stamp}`, object: "charge", amount: 12000, amount_refunded: 12000, payment_intent: pi });
  expect((await request.post("/api/stripe/webhook", signed(refund))).status()).toBe(200);
  expect((await db.payment.findFirstOrThrow({ where: { stripePaymentIntentId: pi } })).status).toBe("REFUNDED");
  await page.goto(track);
  await expect(page.getByRole("button", { name: "Pay €120.00" })).toBeVisible();
  await db.$disconnect();
});
