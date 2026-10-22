export type LatLng = { lat: number; lng: number };

/** Orders in these statuses have a truck on the road, so the driver app shares its position. */
export const MOVING_STATUSES = ["DRIVER_EN_ROUTE", "PICKED_UP", "IN_TRANSIT"] as const;

/** A position older than this is not shown as "live". */
export const FRESH_MS = 10 * 60_000;

/** The driver app sends a point at most this often, or sooner after moving SEND_EVERY_M. */
export const SEND_EVERY_MS = 30_000;
export const SEND_EVERY_M = 150;
/** ...and never more often than this, however fast the truck moves. */
export const MIN_GAP_MS = 10_000;

// Road distance is longer than the straight line, and a tow truck averages well under the limit.
const ROAD_FACTOR = 1.3;
const AVG_KMH = 55;

/** Great-circle distance in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Rough arrival estimate from the straight-line distance, rounded up to 5 minutes.
 * Under half a kilometre the truck counts as there (null).
 */
export function roughEtaMinutes(km: number): number | null {
  if (km < 0.5) return null;
  const min = ((km * ROAD_FACTOR) / AVG_KMH) * 60;
  return Math.max(5, Math.ceil(min / 5) * 5);
}

/** Whether the driver app should send this fix, given the last one it sent. */
export function shouldSend(last: (LatLng & { at: number }) | null, next: LatLng & { at: number }): boolean {
  if (!last) return true;
  const gap = next.at - last.at;
  if (gap < MIN_GAP_MS) return false;
  return gap >= SEND_EVERY_MS || haversineKm(last, next) * 1000 >= SEND_EVERY_M;
}

export function isFresh(at: Date | null | undefined, now = Date.now()): boolean {
  return !!at && now - at.getTime() <= FRESH_MS;
}

export function validCoord(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}
