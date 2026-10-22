import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * WhatsApp Business messages through Meta's Cloud API. Messages we start must
 * use a template approved in WhatsApp Manager: one "order update" template per
 * language with two body variables, the order number and the message text
 * (see README). Without WHATSAPP_PROVIDER=meta, WhatsApp customers get an SMS.
 */
export function whatsappEnabled(): boolean {
  return process.env.WHATSAPP_PROVIDER === "meta" && Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** The recipient cannot get this message on WhatsApp (no account, not reachable, outside the window): send an SMS instead. */
export class WhatsAppRecipientError extends Error {}

// https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
const RECIPIENT_CODES = new Set([131026, 131047, 131049, 131051, 131030, 470]);

export function isRecipientError(code: number | undefined): boolean {
  return code != null && RECIPIENT_CODES.has(code);
}

/** Template variables may not contain new lines, tabs or more than four spaces in a row, and are limited in length. */
export function templateText(s: string, max = 1000): string {
  return s.replace(/\s+/g, " ").trim().slice(0, max) || "-";
}

export function templateMessage(to: string, locale: string, orderNumber: string, text: string) {
  return {
    messaging_product: "whatsapp",
    to: to.replace(/^\+/, ""),
    type: "template",
    template: {
      name: process.env.WHATSAPP_TEMPLATE ?? "order_update",
      language: { code: ["sq", "en", "de"].includes(locale) ? locale : "sq" },
      components: [{ type: "body", parameters: [{ type: "text", text: templateText(orderNumber, 60) }, { type: "text", text: templateText(text) }] }],
    },
  };
}

export async function sendWhatsApp(m: { to: string; locale: string; orderNumber: string; text: string }): Promise<string> {
  const version = process.env.WHATSAPP_API_VERSION ?? "v23.0";
  const res = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(templateMessage(m.to, m.locale, m.orderNumber, m.text)),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[]; error?: { code?: number; message?: string } };
  if (!res.ok || !body.messages?.[0]?.id) {
    const msg = `WhatsApp ${res.status}: ${body.error?.code ?? ""} ${body.error?.message ?? "error"}`.trim();
    throw isRecipientError(body.error?.code) ? new WhatsAppRecipientError(msg) : new Error(msg);
  }
  return body.messages[0].id;
}

/** Meta signs webhook calls with the app secret (X-Hub-Signature-256: sha256=<hex>). */
export function validWebhookSignature(body: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith("sha256=") || !secret) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export type StatusUpdate = { id: string; status: string; errorCode?: number; errorTitle?: string };

/** Delivery statuses from a webhook call; incoming customer messages are ignored here. */
export function statusUpdates(payload: unknown): StatusUpdate[] {
  const out: StatusUpdate[] = [];
  const entries = (payload as { entry?: { changes?: { value?: { statuses?: { id: string; status: string; errors?: { code?: number; title?: string }[] }[] } }[] }[] })?.entry ?? [];
  for (const e of entries) for (const c of e.changes ?? []) for (const s of c.value?.statuses ?? []) out.push({ id: s.id, status: s.status, errorCode: s.errors?.[0]?.code, errorTitle: s.errors?.[0]?.title });
  return out;
}
