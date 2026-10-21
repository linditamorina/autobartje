import "server-only";

export interface RouteEstimate {
  distanceKm: number;
  durationMin: number;
  /** "google" when the Routes API answered, "estimate" for the straight-line fallback. */
  source: "google" | "estimate";
}

interface Point {
  lat: number;
  lng: number;
}

const cache = new Map<string, { value: RouteEstimate; expires: number }>();

/**
 * Driving distance between two points via the Google Routes API, cached for a day.
 * Falls back to straight-line distance × 1.3 (typical road factor in Kosovo)
 * when no key is configured or Google is unreachable, so quotes never fail.
 */
export async function routeDistance(from: Point, to: Point): Promise<RouteEstimate> {
  const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const value = (await googleRoute(from, to)) ?? straightLineEstimate(from, to);
  if (cache.size > 5000) cache.clear();
  cache.set(key, { value, expires: Date.now() + 864e5 });
  return value;
}

async function googleRoute(from: Point, to: Point): Promise<RouteEstimate | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: "DRIVE",
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Routes API ${res.status}`);
    const data = (await res.json()) as { routes?: { distanceMeters?: number; duration?: string }[] };
    const route = data.routes?.[0];
    if (!route?.distanceMeters) return null;
    return {
      distanceKm: Math.round(route.distanceMeters / 100) / 10,
      durationMin: Math.round(parseInt(route.duration ?? "0", 10) / 60),
      source: "google",
    };
  } catch (err) {
    console.warn("[maps] falling back to straight-line distance:", (err as Error).message);
    return null;
  }
}

export function straightLineEstimate(from: Point, to: Point): RouteEstimate {
  const km = haversineKm(from, to) * 1.3;
  return { distanceKm: Math.round(km * 10) / 10, durationMin: Math.round((km / 60) * 60), source: "estimate" };
}

export function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
