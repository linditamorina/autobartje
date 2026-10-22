import "server-only";
import { lookup } from "node:dns/promises";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { decrypt, encrypt } from "@/server/security/crypto";
import type { Prisma } from "@/generated/prisma/client";
import { isPrivateAddress, newWebhookSecret, RETRY_MINUTES, signatureHeader, webhookUrlProblem } from "./signing";

export const WEBHOOK_EVENTS = ["order.created", "order.status_changed"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** After this many failed deliveries in a row the webhook is switched off, and the office sees why. */
const DISABLE_AFTER = 50;
const TIMEOUT_MS = 10_000;

export class WebhookError extends Error {
  constructor(public code: "invalid" | "https" | "private" | "no_events" | "not_found" | "too_many") {
    super(code);
  }
}

const allowPrivate = () => process.env.WEBHOOK_ALLOW_PRIVATE === "1" && process.env.VERCEL_ENV !== "production";

export async function createWebhook(companyId: string, input: { url: string; events: string[] }, actorId: string) {
  const problem = webhookUrlProblem(input.url, allowPrivate());
  if (problem) throw new WebhookError(problem);
  const events = WEBHOOK_EVENTS.filter((e) => input.events.includes(e));
  if (!events.length) throw new WebhookError("no_events");
  if ((await db.webhook.count({ where: { companyId } })) >= 5) throw new WebhookError("too_many");
  const secret = newWebhookSecret();
  const hook = await db.$transaction(async (tx) => {
    const h = await tx.webhook.create({ data: { companyId, url: input.url, events, secretEnc: encrypt(secret) } });
    await audit(tx, { actorId, action: "webhook.created", entityType: "Company", entityId: companyId, after: { webhookId: h.id, url: h.url, events } });
    return h;
  });
  return { hook, secret };
}

export async function deleteWebhook(companyId: string, id: string, actorId: string) {
  await db.$transaction(async (tx) => {
    const h = await tx.webhook.findFirst({ where: { id, companyId } });
    if (!h) throw new WebhookError("not_found");
    await tx.webhook.delete({ where: { id } });
    await audit(tx, { actorId, action: "webhook.deleted", entityType: "Company", entityId: companyId, before: { webhookId: id, url: h.url } });
  });
}

/** Switches a webhook back on after it was disabled by failures. */
export async function enableWebhook(companyId: string, id: string) {
  const r = await db.webhook.updateMany({ where: { id, companyId }, data: { isActive: true, failCount: 0 } });
  if (!r.count) throw new WebhookError("not_found");
}

export async function companyWebhooks(companyId: string) {
  return db.webhook.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, url: true, events: true, isActive: true, failCount: true, lastSuccessAt: true, lastFailureAt: true, lastError: true, createdAt: true,
      deliveries: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, event: true, status: true, attempts: true, responseStatus: true, createdAt: true } },
    },
  });
}

/** Queues an event for every active webhook of the company that wants it, in the caller's transaction. */
export async function enqueueWebhookEvent(tx: Prisma.TransactionClient, companyId: string, event: WebhookEvent, data: Record<string, unknown>) {
  const hooks = await tx.webhook.findMany({ where: { companyId, isActive: true, events: { has: event } }, select: { id: true } });
  if (!hooks.length) return;
  const occurredAt = new Date().toISOString();
  for (const h of hooks) {
    // The delivery id doubles as the event id partners use to drop duplicates.
    const d = await tx.webhookDelivery.create({ data: { webhookId: h.id, event, payload: {} } });
    await tx.webhookDelivery.update({ where: { id: d.id }, data: { payload: { id: d.id, event, occurredAt, data } as Prisma.InputJsonValue } });
  }
}

/** A test event the office can send from the company page. */
export async function sendTestEvent(companyId: string, id: string) {
  const h = await db.webhook.findFirst({ where: { id, companyId } });
  if (!h) throw new WebhookError("not_found");
  await db.$transaction(async (tx) => {
    const d = await tx.webhookDelivery.create({ data: { webhookId: h.id, event: "ping", payload: {} } });
    await tx.webhookDelivery.update({ where: { id: d.id }, data: { payload: { id: d.id, event: "ping", occurredAt: new Date().toISOString(), data: {} } } });
  });
}

/** Refuses to connect when the host name now points into a private network (checked on every send, not only when saved). */
async function resolvesPublic(url: URL): Promise<boolean> {
  if (allowPrivate()) return true;
  try {
    const addrs = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

async function deliver(d: { id: string; payload: Prisma.JsonValue; attempts: number; webhook: { id: string; url: string; secretEnc: string; failCount: number } }) {
  const body = JSON.stringify(d.payload);
  const url = new URL(d.webhook.url);
  let status: number | null = null;
  let error: string | null = null;
  if (!(await resolvesPublic(url))) {
    error = "Address is not public";
  } else {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "autobartje-webhooks/1", "x-autobartje-signature": signatureHeader(decrypt(d.webhook.secretEnc), body), "x-autobartje-delivery": d.id },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = res.status;
      if (res.status < 200 || res.status >= 300) error = `HTTP ${res.status}`;
      await res.body?.cancel().catch(() => {});
    } catch (err) {
      error = err instanceof Error ? err.message.slice(0, 200) : "Request failed";
    }
  }
  const now = new Date();
  const attempts = d.attempts + 1;
  if (!error) {
    await db.$transaction([
      db.webhookDelivery.update({ where: { id: d.id }, data: { status: "SENT", attempts, responseStatus: status, sentAt: now, lastError: null } }),
      db.webhook.update({ where: { id: d.webhook.id }, data: { failCount: 0, lastSuccessAt: now } }),
    ]);
    return true;
  }
  const retryIn = RETRY_MINUTES[attempts - 1];
  const failCount = d.webhook.failCount + 1;
  await db.$transaction([
    db.webhookDelivery.update({
      where: { id: d.id },
      data: retryIn ? { attempts, responseStatus: status, lastError: error, nextAttemptAt: new Date(now.getTime() + retryIn * 60_000) } : { status: "FAILED", attempts, responseStatus: status, lastError: error },
    }),
    db.webhook.update({ where: { id: d.webhook.id }, data: { failCount, lastFailureAt: now, lastError: error, isActive: failCount < DISABLE_AFTER } }),
  ]);
  return false;
}

/** Sends due deliveries, oldest first. Called right after order changes and by the every-minute cron. */
export async function processWebhooks(limit = 25): Promise<{ sent: number; failed: number }> {
  const due = await db.webhookDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() }, webhook: { isActive: true } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, payload: true, attempts: true, nextAttemptAt: true, webhook: { select: { id: true, url: true, secretEnc: true, failCount: true } } },
  });
  let sent = 0;
  for (const d of due) {
    // Claim it, so a parallel run (cron + immediate send) does not send it twice.
    const claimed = await db.webhookDelivery.updateMany({ where: { id: d.id, status: "PENDING", nextAttemptAt: d.nextAttemptAt }, data: { nextAttemptAt: new Date(Date.now() + 5 * 60_000) } });
    if (!claimed.count) continue;
    if (await deliver(d)) sent++;
  }
  return { sent, failed: due.length - sent };
}
