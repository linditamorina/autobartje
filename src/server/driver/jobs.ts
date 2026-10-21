import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { putPrivateObject } from "@/server/files/storage";
import { changeOrderStatus } from "@/server/orders/manage";
import { startOfBusinessDay } from "@/lib/time";
import { inspectionComplete, inspectionOpen, missingForInspection, nextDriverStep, type DriverPhotoAngle, type InspectionKind } from "./steps";

export class DriverError extends Error {
  constructor(public code: "not_driver" | "not_assigned" | "wrong_step" | "inspection_missing" | "inspection_closed" | "bad_file" | "invalid_amount") {
    super(code);
  }
}

export const PHOTO_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
// Phones shrink photos before upload; this also keeps requests under the host's body limit.
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export async function driverForUser(userId: string) {
  const driver = await db.driver.findUnique({ where: { userId }, include: { user: { select: { name: true } } } });
  if (!driver || !driver.isActive) throw new DriverError("not_driver");
  return driver;
}

const OPEN = ["CONFIRMED", "DRIVER_EN_ROUTE", "PICKED_UP", "IN_TRANSIT"] as const;

/** Jobs to do (oldest planned first) and jobs finished today. */
export async function driverJobs(driverId: string) {
  const assignments = await db.assignment.findMany({
    where: {
      driverId,
      isActive: true,
      OR: [{ order: { status: { in: [...OPEN] } } }, { order: { status: { in: ["DELIVERED", "COMPLETED"] } }, finishedAt: { gte: startOfBusinessDay() } }],
    },
    include: {
      truck: { select: { plate: true, name: true } },
      order: {
        select: {
          id: true, number: true, status: true, priority: true, service: true, pickupAddress: true, dropoffAddress: true, isAsap: true, requestedAt: true,
          customer: { select: { fullName: true } },
          vehicle: { select: { make: true, model: true, plate: true } },
        },
      },
    },
    orderBy: { plannedStart: "asc" },
  });
  const done = assignments.filter((a) => !OPEN.includes(a.order.status as never));
  const todo = assignments.filter((a) => OPEN.includes(a.order.status as never));
  // Urgent jobs first, then by planned start.
  todo.sort((a, b) => Number(b.order.priority === "URGENT") - Number(a.order.priority === "URGENT") || a.plannedStart.getTime() - b.plannedStart.getTime());
  return { todo, done };
}

async function activeAssignment(driverId: string, orderId: string) {
  const a = await db.assignment.findFirst({ where: { driverId, orderId, isActive: true } });
  if (!a) throw new DriverError("not_assigned");
  return a;
}

export async function driverJob(driverId: string, orderId: string) {
  const a = await activeAssignment(driverId, orderId);
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      customer: { select: { fullName: true, phone: true, preferredChannel: true } },
      vehicle: true,
      notes: { orderBy: { createdAt: "desc" }, take: 5, include: { author: { select: { name: true } } } },
      inspections: { include: { photos: { orderBy: { createdAt: "asc" } } } },
      payments: { where: { status: "SUCCEEDED" }, orderBy: { createdAt: "asc" } },
    },
  });
  const truck = await db.truck.findUnique({ where: { id: a.truckId }, select: { plate: true, name: true } });
  return { assignment: a, truck, order };
}

/** Moves the job one step on. Pickup needs the pickup photos; delivery needs photos and the customer's signature. */
export async function advanceJob(userId: string, orderId: string, to: string, pos: { lat?: number; lng?: number }) {
  const driver = await driverForUser(userId);
  const a = await activeAssignment(driver.id, orderId);
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, service: true, inspections: { include: { photos: { select: { angle: true } } } } } });
  const step = nextDriverStep(order.status, order.service);
  // A double tap or a stale screen asks for a step that already happened: tell the driver instead of failing silently.
  if (!step || step.to !== to) throw new DriverError("wrong_step");
  if (step.needs && !inspectionComplete(order.inspections.find((i) => i.kind === step.needs), step.needs)) throw new DriverError("inspection_missing");

  await changeOrderStatus(orderId, step.to, userId, { lat: pos.lat, lng: pos.lng });
  const now = new Date();
  if (step.action === "start" && !a.startedAt) await db.assignment.update({ where: { id: a.id }, data: { startedAt: now } });
  if (step.to === "DELIVERED") await db.assignment.update({ where: { id: a.id }, data: { finishedAt: now } });
  if (pos.lat != null && pos.lng != null) await db.driver.update({ where: { id: driver.id }, data: { lastLat: pos.lat, lastLng: pos.lng, lastSeenAt: now } });
  return step;
}

async function openInspection(driverId: string, orderId: string, kind: InspectionKind) {
  await activeAssignment(driverId, orderId);
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } });
  if (!inspectionOpen(order.status, kind)) throw new DriverError("inspection_closed");
  const existing = await db.inspection.findUnique({ where: { orderId_kind: { orderId, kind } } });
  // Once the customer has signed, the record is closed.
  if (existing?.signedAt) throw new DriverError("inspection_closed");
  return existing ?? (await db.inspection.create({ data: { orderId, kind, driverId } }));
}

/** Stores one inspection photo with its SHA-256, so later edits to the file can be detected. */
export async function addInspectionPhoto(
  userId: string,
  input: { orderId: string; kind: InspectionKind; angle: DriverPhotoAngle; bytes: Uint8Array; contentType: string; takenAt?: Date; lat?: number; lng?: number },
) {
  const driver = await driverForUser(userId);
  const ext = PHOTO_TYPES[input.contentType as keyof typeof PHOTO_TYPES];
  if (!ext || input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_PHOTO_BYTES || !looksLikeImage(input.bytes)) throw new DriverError("bad_file");
  const insp = await openInspection(driver.id, input.orderId, input.kind);

  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const key = `inspections/${input.orderId}/${input.kind.toLowerCase()}/${randomUUID()}.${ext}`;
  await putPrivateObject(key, input.bytes, input.contentType);
  const now = new Date();
  // A taken-at time from the phone is kept only if it is plausible (not in the future, not days old).
  const takenAt = input.takenAt && input.takenAt <= now && now.getTime() - input.takenAt.getTime() < 24 * 3600_000 ? input.takenAt : now;
  return db.inspectionPhoto.create({ data: { inspectionId: insp.id, angle: input.angle, objectKey: key, takenAt, lat: input.lat, lng: input.lng, sha256 } });
}

function looksLikeImage(b: Uint8Array): boolean {
  const jpeg = b[0] === 0xff && b[1] === 0xd8;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45;
  return jpeg || png || webp;
}

export async function removeInspectionPhoto(userId: string, photoId: string) {
  const driver = await driverForUser(userId);
  const photo = await db.inspectionPhoto.findUnique({ where: { id: photoId }, include: { inspection: true } });
  if (!photo) return;
  await openInspection(driver.id, photo.inspection.orderId, photo.inspection.kind);
  // The file stays in storage until retention removes the inspection; only the record goes.
  await db.inspectionPhoto.delete({ where: { id: photoId } });
}

/** Saves odometer, fuel and notes; at delivery also the customer's name and signature (PNG). */
export async function saveInspection(
  userId: string,
  input: { orderId: string; kind: InspectionKind; odometerKm: number | null; fuelLevel: number | null; notes: string | null; signerName?: string | null; signaturePng?: Uint8Array | null; lat?: number; lng?: number },
) {
  const driver = await driverForUser(userId);
  const insp = await openInspection(driver.id, input.orderId, input.kind);
  let signatureKey: string | undefined;
  if (input.signaturePng) {
    const b = input.signaturePng;
    if (b.byteLength > 512 * 1024 || !(b[0] === 0x89 && b[1] === 0x50)) throw new DriverError("bad_file");
    const photos = await db.inspectionPhoto.findMany({ where: { inspectionId: insp.id }, select: { angle: true } });
    // The customer signs off on the photos, so they must be there first.
    if (missingForInspection({ photos, signedAt: null }, input.kind).angles.length) throw new DriverError("inspection_missing");
    signatureKey = `inspections/${input.orderId}/${input.kind.toLowerCase()}/signature-${randomUUID()}.png`;
    await putPrivateObject(signatureKey, b, "image/png");
  }
  await db.$transaction(async (tx) => {
    await tx.inspection.update({
      where: { id: insp.id },
      data: {
        odometerKm: input.odometerKm,
        fuelLevel: input.fuelLevel,
        notes: input.notes,
        lat: input.lat,
        lng: input.lng,
        ...(signatureKey ? { signatureKey, signerName: input.signerName ?? null, signedAt: new Date() } : {}),
      },
    });
    await audit(tx, { actorId: userId, action: signatureKey ? "inspection.signed" : "inspection.saved", entityType: "Inspection", entityId: insp.id, after: { kind: input.kind, odometerKm: input.odometerKm, signerName: input.signerName } });
  });
}

/** Cash the driver took from the customer. It is matched to the invoice when the office issues it. */
export async function recordCash(userId: string, orderId: string, amountCents: number) {
  const driver = await driverForUser(userId);
  await activeAssignment(driver.id, orderId);
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 1_000_000) throw new DriverError("invalid_amount");
  await db.$transaction(async (tx) => {
    const p = await tx.payment.create({ data: { orderId, method: "CASH", status: "SUCCEEDED", amountCents, receivedById: userId, receivedAt: new Date() } });
    await audit(tx, { actorId: userId, action: "payment.cash_collected", entityType: "Payment", entityId: p.id, after: { orderId, amountCents } });
  });
}
