import "server-only";
import Stripe from "stripe";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { getBrand } from "@/server/settings";
import { notifyCustomer } from "@/server/orders/manage";
import { paymentStatus } from "@/server/invoicing/calc";
import { TOKEN_RE, trackUrl } from "@/lib/tracking";
import { onlineDue } from "./due";

/** Online payments are on when both keys are set (Settings cannot turn them on without Stripe). */
export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

let client: Stripe | null = null;
function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 15_000 });
  return client;
}

export class PaymentError extends Error {
  constructor(public code: "not_found" | "nothing_due" | "disabled") {
    super(code);
  }
}

async function orderForPayment(where: { trackingToken: string } | { id: string }) {
  return db.order.findUnique({
    where,
    select: {
      id: true, number: true, status: true, finalCents: true, locale: true, trackingToken: true,
      customer: { select: { email: true, anonymizedAt: true } },
      payments: { select: { amountCents: true, status: true } },
      invoices: { where: { kind: "INVOICE", status: { not: "VOID" } }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, totalCents: true, paidCents: true } },
    },
  });
}

/** Amount the tracking page offers to pay, or null. */
export async function dueForToken(token: string) {
  if (!stripeEnabled() || !TOKEN_RE.test(token)) return null;
  const o = await orderForPayment({ trackingToken: token });
  if (!o || o.customer.anonymizedAt) return null;
  return onlineDue({ ...o, invoice: o.invoices[0] ?? null });
}

const CHECKOUT_LOCALE: Record<string, Stripe.Checkout.SessionCreateParams.Locale> = { en: "en", de: "de" };

/** Starts a Stripe Checkout for what is due on the order and returns its URL. */
export async function createCheckout(token: string): Promise<string> {
  if (!stripeEnabled()) throw new PaymentError("disabled");
  if (!TOKEN_RE.test(token)) throw new PaymentError("not_found");
  const o = await orderForPayment({ trackingToken: token });
  if (!o || o.customer.anonymizedAt) throw new PaymentError("not_found");
  const due = onlineDue({ ...o, invoice: o.invoices[0] ?? null });
  if (!due) throw new PaymentError("nothing_due");
  const brand = await getBrand();
  const back = trackUrl(o.trackingToken, o.locale);
  const metadata = { orderId: o.id, invoiceId: due.invoiceId ?? "" };
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: due.amountCents, product_data: { name: `${brand.name} · ${o.number}` } } }],
      client_reference_id: o.id,
      metadata,
      payment_intent_data: { metadata, description: o.number },
      customer_email: o.customer.email ?? undefined,
      locale: CHECKOUT_LOCALE[o.locale] ?? "auto",
      success_url: `${back}?paid=1`,
      cancel_url: back,
    },
    // A double tap within the same minute gets the same session.
    { idempotencyKey: `checkout-${o.id}-${due.amountCents}-${Math.floor(Date.now() / 60_000)}` },
  );
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

/** Checks the signature and parses a webhook call. Throws on a bad signature. */
export function parseWebhook(body: string, signature: string | null): Stripe.Event {
  return Stripe.webhooks.constructEvent(body, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET ?? "");
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      if (s.payment_status !== "paid" || !s.metadata?.orderId || s.amount_total == null) return;
      const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
      if (!pi) return;
      await recordOnlinePayment({ orderId: s.metadata.orderId, invoiceId: s.metadata.invoiceId || null, amountCents: s.amount_total, paymentIntentId: pi });
      return;
    }
    case "charge.refunded": {
      const c = event.data.object;
      const pi = typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id;
      if (pi) await recordRefund(pi, c.amount_refunded, c.amount);
      return;
    }
  }
}

/** Stripe's hosted receipt for the payment; best effort, the message goes out without it. */
async function receiptUrl(paymentIntentId: string): Promise<string | null> {
  try {
    const pi = await stripe().paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    const charge = pi.latest_charge;
    return typeof charge === "object" && charge ? charge.receipt_url : null;
  } catch {
    return null;
  }
}

/** Books a card payment once (webhooks can arrive twice) and counts it towards the open invoice. */
export async function recordOnlinePayment(p: { orderId: string; invoiceId: string | null; amountCents: number; paymentIntentId: string }) {
  const receipt = await receiptUrl(p.paymentIntentId);
  await db.$transaction(async (tx) => {
    if (await tx.payment.findUnique({ where: { stripePaymentIntentId: p.paymentIntentId } })) return;
    const order = await tx.order.findUnique({ where: { id: p.orderId }, include: { customer: true } });
    if (!order) throw new Error(`Stripe payment for unknown order ${p.orderId}`);

    let invoiceId: string | null = null;
    if (p.invoiceId) {
      await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${p.invoiceId} FOR UPDATE`;
      const inv = await tx.invoice.findUnique({ where: { id: p.invoiceId } });
      // Only an invoice that is still open and not overpaid takes it; otherwise the payment waits on the order.
      if (inv && ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status) && inv.paidCents + p.amountCents <= inv.totalCents) {
        invoiceId = inv.id;
        const paidCents = inv.paidCents + p.amountCents;
        await tx.invoice.update({ where: { id: inv.id }, data: { paidCents, status: paymentStatus(inv.totalCents, paidCents, inv.dueDate) } });
      }
    }
    const payment = await tx.payment.create({
      data: { orderId: order.id, invoiceId, method: "CARD", status: "SUCCEEDED", amountCents: p.amountCents, stripePaymentIntentId: p.paymentIntentId, receivedAt: new Date() },
    });
    await audit(tx, { actorId: null, action: "payment.online_succeeded", entityType: "Payment", entityId: payment.id, after: { orderId: order.id, invoiceId, amountCents: p.amountCents } });
    if (!order.customer.anonymizedAt) {
      await notifyCustomer(tx, order.customer, "payment_received", { amountCents: p.amountCents, orderNumber: order.number, receiptUrl: receipt, locale: order.locale }, order.id);
    }
  });
}

/** A full refund in Stripe marks the payment refunded and takes it off the invoice. Partial refunds are left to the office. */
async function recordRefund(paymentIntentId: string, refunded: number, amount: number) {
  await db.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
    if (!p || p.status === "REFUNDED") return;
    if (refunded < amount) {
      await audit(tx, { actorId: null, action: "payment.partially_refunded", entityType: "Payment", entityId: p.id, after: { refundedCents: refunded } });
      return;
    }
    await tx.payment.update({ where: { id: p.id }, data: { status: "REFUNDED" } });
    if (p.invoiceId) {
      const inv = await tx.invoice.findUniqueOrThrow({ where: { id: p.invoiceId } });
      const paidCents = Math.max(0, inv.paidCents - p.amountCents);
      await tx.invoice.update({ where: { id: inv.id }, data: { paidCents, status: inv.status === "VOID" ? "VOID" : paymentStatus(inv.totalCents, paidCents, inv.dueDate) } });
    }
    await audit(tx, { actorId: null, action: "payment.refunded", entityType: "Payment", entityId: p.id, after: { amountCents: p.amountCents } });
  });
}
