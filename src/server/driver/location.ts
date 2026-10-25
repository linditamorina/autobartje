import "server-only";
import { db } from "@/server/db";
import { haversineKm, isFresh, MIN_GAP_MS, MOVING_STATUSES, roughEtaMinutes, validCoord, type LatLng } from "@/lib/geo";
import { driverForUser } from "./jobs";

export type PositionInput = { lat: number; lng: number; accuracyM?: number; speedKmh?: number; heading?: number; recordedAt?: Date };

// A fix this vague (cell towers only) would put the truck in the wrong village.
const MAX_ACCURACY_M = 500;

/** The job the truck is driving for right now: urgent first, then the earliest planned. */
async function movingAssignment(driverId: string) {
  return db.assignment.findFirst({
    where: { driverId, isActive: true, order: { status: { in: [...MOVING_STATUSES] } } },
    orderBy: [{ order: { priority: "desc" } }, { plannedStart: "asc" }],
    select: { orderId: true },
  });
}

/** Writes one point for an order and moves the driver's "last seen" marker. */
export async function storePosition(driverId: string, orderId: string, p: PositionInput) {
  const now = new Date();
  // Phones with a wrong clock or a queued fix: keep the time only when it is plausible.
  const recordedAt = p.recordedAt && p.recordedAt <= now && now.getTime() - p.recordedAt.getTime() < 5 * 60_000 ? p.recordedAt : now;
  await db.$transaction([
    db.driverPosition.create({
      data: {
        driverId,
        orderId,
        lat: p.lat,
        lng: p.lng,
        accuracyM: p.accuracyM != null ? Math.round(p.accuracyM) : null,
        speedKmh: p.speedKmh != null ? Math.round(p.speedKmh) : null,
        heading: p.heading != null ? Math.round(p.heading) % 360 : null,
        recordedAt,
      },
    }),
    db.driver.update({ where: { id: driverId }, data: { lastLat: p.lat, lastLng: p.lng, lastSeenAt: recordedAt } }),
  ]);
}

/**
 * A point from the driver app. Stored only while one of the driver's jobs is
 * under way; otherwise the app is told to stop sharing.
 */
export async function recordPosition(userId: string, p: PositionInput): Promise<{ sharing: boolean; stored: boolean }> {
  if (!validCoord(p.lat, p.lng)) return { sharing: true, stored: false };
  const driver = await driverForUser(userId);
  const job = await movingAssignment(driver.id);
  if (!job) return { sharing: false, stored: false };
  if (p.accuracyM != null && p.accuracyM > MAX_ACCURACY_M) return { sharing: true, stored: false };
  // The app already throttles; this guards against two open tabs or a misbehaving phone.
  if (driver.lastSeenAt && Date.now() - driver.lastSeenAt.getTime() < MIN_GAP_MS - 2_000) return { sharing: true, stored: false };
  await storePosition(driver.id, job.orderId, p);
  return { sharing: true, stored: true };
}

/** Whether the driver app should share the position at all. */
export async function driverIsMoving(driverId: string): Promise<boolean> {
  return (await movingAssignment(driverId)) != null;
}

type Stop = { lat: number | null; lng: number | null };

/** Where the truck is heading: the pickup until the car is loaded, then the drop-off. */
export function nextStop(status: string, pickup: Stop, dropoff: Stop): LatLng | null {
  const s = status === "DRIVER_EN_ROUTE" ? pickup : status === "IN_TRANSIT" ? dropoff : null;
  return s && s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : null;
}

function distanceTo(pos: LatLng, target: LatLng | null) {
  if (!target) return { km: null, etaMin: null };
  const km = haversineKm(pos, target);
  return { km: Math.round(km * 10) / 10, etaMin: roughEtaMinutes(km) };
}

/** For the customer's tracking page: the truck's latest fresh point for this order, while it is on the road. */
export async function truckPosition(orderId: string, status: string, pickup: Stop, dropoff: Stop) {
  if (!(MOVING_STATUSES as readonly string[]).includes(status)) return null;
  const p = await db.driverPosition.findFirst({ where: { orderId }, orderBy: { recordedAt: "desc" }, select: { lat: true, lng: true, recordedAt: true } });
  if (!p || !isFresh(p.recordedAt)) return null;
  return { lat: p.lat, lng: p.lng, at: p.recordedAt, ...distanceTo(p, nextStop(status, pickup, dropoff)) };
}

/** The office's live map: every job on the road, with where its truck was last seen. */
export async function liveFleet() {
  const jobs = await db.assignment.findMany({
    where: { isActive: true, order: { status: { in: [...MOVING_STATUSES] } } },
    orderBy: [{ order: { priority: "desc" } }, { plannedStart: "asc" }],
    select: {
      driver: { select: { id: true, lastLat: true, lastLng: true, lastSeenAt: true, user: { select: { name: true, phone: true } } } },
      truck: { select: { plate: true, name: true } },
      order: {
        select: {
          id: true, number: true, status: true, service: true, priority: true,
          pickupAddress: true, pickupLat: true, pickupLng: true, dropoffAddress: true, dropoffLat: true, dropoffLng: true,
          positions: { orderBy: { recordedAt: "desc" }, take: 1, select: { lat: true, lng: true, recordedAt: true, speedKmh: true } },
        },
      },
    },
  });
  return jobs.map(({ driver, truck, order }) => {
    const { positions, pickupLat, pickupLng, dropoffLat, dropoffLng, ...o } = order;
    const p = positions[0] ?? null;
    const target = nextStop(o.status, { lat: pickupLat, lng: pickupLng }, { lat: dropoffLat, lng: dropoffLng });
    return {
      driver: { id: driver.id, name: driver.user.name, phone: driver.user.phone },
      truck,
      order: { ...o, pickup: pickupLat != null && pickupLng != null ? { lat: pickupLat, lng: pickupLng } : null, dropoff: dropoffLat != null && dropoffLng != null ? { lat: dropoffLat, lng: dropoffLng } : null },
      position: p ? { lat: p.lat, lng: p.lng, at: p.recordedAt, speedKmh: p.speedKmh, fresh: isFresh(p.recordedAt), ...distanceTo(p, target) } : null,
    };
  });
}

export type LiveJob = Awaited<ReturnType<typeof liveFleet>>[number];

/** The route the truck drove for an order, oldest point first (thinned to at most ~500 points). */
export async function orderTrail(orderId: string): Promise<{ lat: number; lng: number; at: Date }[]> {
  const rows = await db.driverPosition.findMany({ where: { orderId }, orderBy: { recordedAt: "asc" }, select: { lat: true, lng: true, recordedAt: true }, take: 5000 });
  const step = Math.max(1, Math.ceil(rows.length / 500));
  const thin = rows.filter((_, i) => i % step === 0 || i === rows.length - 1);
  return thin.map((r) => ({ lat: r.lat, lng: r.lng, at: r.recordedAt }));
}
