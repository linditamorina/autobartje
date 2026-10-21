import "server-only";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { BUSINESS_TZ } from "@/lib/time";
import { formatPhone } from "@/lib/contact";
import type { NotificationEvent } from "./events";
import { ProviderNotConfigured, sendEmail, sendSms } from "./providers";
import { emailHtml, renderMessage, toGsm, type RenderContext } from "./templates";
import { MAX_ATTEMPTS, retryDelayMin } from "./retry";

/** While a row is being sent it is leased: another worker skips it until the lease runs out. */
const LEASE_MIN = 5;

/**
 * Sends due outbox messages. Safe to run from several places at once (cron,
 * right after a booking): rows are claimed with FOR UPDATE SKIP LOCKED.
 */
export async function processOutbox(limit = 25): Promise<{ sent: number; failed: number; skipped: number }> {
  const claimed = await db.$queryRaw<{ id: string }[]>`
    UPDATE "NotificationOutbox" SET "attempts" = "attempts" + 1, "sendAfter" = now() + make_interval(mins => ${LEASE_MIN})
    WHERE "id" IN (
      SELECT "id" FROM "NotificationOutbox"
      WHERE "status" = 'PENDING' AND "sendAfter" <= now()
      ORDER BY "sendAfter" LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"`;
  const result = { sent: 0, failed: 0, skipped: 0 };
  if (!claimed.length) return result;

  const s = await getSettings();
  const ctx: RenderContext = {
    brand: s["brand.name"],
    phone: formatPhone(s["contact.phone"]),
    primaryColor: s["brand.primaryColor"],
    reviewUrl: s["review.url"],
    timeZone: BUSINESS_TZ,
  };
  const rows = await db.notificationOutbox.findMany({ where: { id: { in: claimed.map((r) => r.id) } } });

  for (const row of rows) {
    const rendered = renderMessage(row.event as NotificationEvent, (row.payload ?? {}) as Record<string, unknown>, ctx);
    if (!rendered) {
      await db.notificationOutbox.update({ where: { id: row.id }, data: { status: "SKIPPED" } });
      result.skipped++;
      continue;
    }
    try {
      // WhatsApp Business API arrives in phase 2; until then WhatsApp customers get an SMS.
      const providerId =
        row.channel === "EMAIL"
          ? await sendEmail({ to: row.to, subject: rendered.subject, text: rendered.text, html: emailHtml(rendered, ctx) })
          : await sendSms({ to: row.to, text: toGsm(rendered.text) });
      await db.notificationOutbox.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date(), providerId, lastError: null } });
      result.sent++;
    } catch (err) {
      const final = err instanceof ProviderNotConfigured || row.attempts >= MAX_ATTEMPTS;
      await db.notificationOutbox.update({
        where: { id: row.id },
        data: {
          status: final ? "FAILED" : "PENDING",
          lastError: (err as Error).message.slice(0, 500),
          sendAfter: final ? undefined : new Date(Date.now() + retryDelayMin(row.attempts) * 60_000),
        },
      });
      result.failed++;
    }
  }
  return result;
}
