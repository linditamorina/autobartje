import "server-only";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { enqueueNotification } from "@/server/notifications/enqueue";
import { deleteObject, privateStorageAvailable } from "@/server/files/storage";
import { daysFromNow, startOfBusinessDay } from "@/lib/time";
import { remindersDue, type ExpiryItem } from "./expiry";

const OUTBOX_KEEP_DAYS = 90;

/** Fleet paperwork reminders to the office email (and the dispatch phone for today/tomorrow). */
export async function fleetReminders() {
  const today = startOfBusinessDay();
  const horizon = daysFromNow(31);
  const [trucks, drivers, s] = await Promise.all([
    db.truck.findMany({ where: { isActive: true } }),
    db.driver.findMany({ where: { isActive: true }, include: { user: { select: { name: true } } } }),
    getSettings(),
  ]);
  const items: ExpiryItem[] = [];
  const push = (who: string, kind: string, date: Date | null) => date && date <= horizon && items.push({ who, kind, date });
  for (const t of trucks) {
    push(t.plate, "insurance", t.insuranceExpires);
    push(t.plate, "registration", t.registrationExpires);
    push(t.plate, "inspection", t.inspectionExpires);
    push(t.plate, "service", t.nextServiceAt);
  }
  for (const d of drivers) {
    push(d.user.name, "license", d.licenseExpires);
    push(d.user.name, "cpc", d.cpcExpires);
  }
  const due = remindersDue(items, today);
  if (!due.length) return 0;

  const KIND: Record<string, string> = { insurance: "sigurimi", registration: "regjistrimi", inspection: "kontrolli teknik", service: "servisi", license: "patenta", cpc: "karta CPC" };
  const lines = due.map((i) => `• ${i.who}: ${KIND[i.kind] ?? i.kind} – ${i.daysLeft === 0 ? "sot" : `për ${i.daysLeft} ditë`}`).join("\n");
  await db.$transaction(async (tx) => {
    if (s["contact.email"]) await enqueueNotification(tx, { event: "admin_fleet_expiry", channel: "EMAIL", to: s["contact.email"], payload: { lines } });
    const alertPhone = process.env.DISPATCH_ALERT_PHONE;
    const urgent = due.filter((i) => i.daysLeft <= 1);
    if (alertPhone && urgent.length) {
      await enqueueNotification(tx, { event: "admin_fleet_expiry", channel: "SMS", to: alertPhone, payload: { lines: urgent.map((i) => `${i.who}: ${KIND[i.kind] ?? i.kind}`).join(", ") } });
    }
  });
  return due.length;
}

/** Deletes personal data past its retention period (settings → Data retention). */
export async function applyRetention() {
  const s = await getSettings();
  const now = Date.now();
  const before = (days: number) => new Date(now - days * 86_400_000);
  const closed = { status: { in: ["COMPLETED", "CANCELLED"] as ("COMPLETED" | "CANCELLED")[] } };

  const quotes = await db.quote.deleteMany({ where: { orderId: null, createdAt: { lt: before(s["retention.draftsDays"]) } } });
  const gps = await db.driverPosition.deleteMany({ where: { createdAt: { lt: before(s["retention.gpsDays"]) } } });
  const outbox = await db.notificationOutbox.deleteMany({ where: { status: { in: ["SENT", "SKIPPED", "FAILED"] }, createdAt: { lt: before(OUTBOX_KEEP_DAYS) } } });

  const docs = await db.document.findMany({
    where: {
      OR: [
        { purgeAfter: { lte: new Date(now) } },
        { purgeAfter: null, type: "VEHICLE_PHOTO", createdAt: { lt: before(s["retention.inspectionPhotosDays"]) }, order: closed },
        { purgeAfter: null, type: { not: "VEHICLE_PHOTO" }, createdAt: { lt: before(s["retention.documentsDays"]) }, order: closed },
      ],
    },
    select: { id: true, objectKey: true },
    take: 500,
  });
  let files = 0;
  for (const d of docs) {
    // Remove the file first; if storage fails the row stays and is retried tomorrow.
    if (privateStorageAvailable()) {
      try {
        await deleteObject(d.objectKey);
      } catch (err) {
        console.error("[retention] could not delete", d.objectKey, err);
        continue;
      }
    }
    await db.document.delete({ where: { id: d.id } });
    files++;
  }

  // Inspection photos and signatures of closed orders
  const inspections = await db.inspection.findMany({
    where: { OR: [{ purgeAfter: { lte: new Date(now) } }, { purgeAfter: null, createdAt: { lt: before(s["retention.inspectionPhotosDays"]) }, order: closed }] },
    select: { id: true, signatureKey: true, photos: { select: { objectKey: true } } },
    take: 200,
  });
  for (const i of inspections) {
    const keys = [...i.photos.map((p) => p.objectKey), ...(i.signatureKey ? [i.signatureKey] : [])];
    try {
      if (privateStorageAvailable()) for (const k of keys) await deleteObject(k);
    } catch (err) {
      console.error("[retention] could not delete inspection files", i.id, err);
      continue;
    }
    await db.inspection.delete({ where: { id: i.id } });
    files += keys.length;
  }
  return { quotes: quotes.count, outbox: outbox.count, gps: gps.count, files };
}
