"use client";

let loading: Promise<typeof google.maps> | null = null;

/** Loads the Maps JavaScript API once. Resolves to null when no browser key is configured. */
export function loadGoogleMaps(language: string): Promise<typeof google.maps> | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) return null;
  loading ??= new Promise((resolve, reject) => {
    const cb = "__abMapsReady";
    (window as unknown as Record<string, () => void>)[cb] = () => resolve(google.maps);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&language=${language}&region=XK&callback=${cb}`;
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error("Google Maps failed to load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Rough bounding box of Kosovo, used to keep domestic suggestions local. */
export const KOSOVO_BOUNDS = { north: 43.27, south: 41.85, east: 21.8, west: 20.01 };
