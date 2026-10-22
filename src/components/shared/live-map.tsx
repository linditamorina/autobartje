"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/components/booking/google-maps";
import type { LatLng } from "@/lib/geo";

export type MapPoint = LatLng & { id: string; kind: "truck" | "pickup" | "dropoff"; title: string; href?: string; stale?: boolean };

const COLORS = { truck: "#c2410c", pickup: "#0b2545", dropoff: "#15803d" } as const;
const LABELS = { truck: "🚚", pickup: "A", dropoff: "B" } as const;

/**
 * Google map with trucks, pickups and drop-offs, and optionally the route driven.
 * Markers move in place when the page refreshes, so the view does not jump.
 * Without a Maps key it renders nothing; pages show the same facts as text.
 */
export function LiveMap({ points, trail, language, className }: { points: MapPoint[]; trail?: LatLng[]; language: string; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef(new Map<string, google.maps.Marker>());
  const line = useRef<google.maps.Polyline | null>(null);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const [available] = useState(() => !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY);

  useEffect(() => {
    const p = loadGoogleMaps(language);
    if (!p) return;
    let cancelled = false;
    p.then((g) => {
      if (cancelled || !el.current || map.current) return;
      map.current = new g.Map(el.current, { center: { lat: 42.66, lng: 20.29 }, zoom: 9, mapTypeControl: false, streetViewControl: false, fullscreenControl: true, clickableIcons: false });
      setReady(true);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const seen = new Set<string>();
    for (const pt of points) {
      seen.add(pt.id);
      const icon: google.maps.Symbol = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: pt.kind === "truck" ? 14 : 10,
        fillColor: COLORS[pt.kind],
        fillOpacity: pt.stale ? 0.45 : 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      };
      const existing = markers.current.get(pt.id);
      if (existing) {
        existing.setPosition(pt);
        existing.setIcon(icon);
        existing.setTitle(pt.title);
      } else {
        const mk = new google.maps.Marker({ map: m, position: pt, title: pt.title, icon, label: { text: LABELS[pt.kind], color: "#ffffff", fontSize: "12px", fontWeight: "700" }, zIndex: pt.kind === "truck" ? 10 : 1 });
        if (pt.href) mk.addListener("click", () => window.location.assign(pt.href!));
        markers.current.set(pt.id, mk);
      }
    }
    for (const [id, mk] of markers.current) {
      if (!seen.has(id)) {
        mk.setMap(null);
        markers.current.delete(id);
      }
    }
    if (trail && trail.length > 1) {
      if (!line.current) line.current = new google.maps.Polyline({ map: m, strokeColor: COLORS.truck, strokeOpacity: 0.8, strokeWeight: 4 });
      line.current.setPath(trail);
    }
    if (!fitted.current && (points.length || trail?.length)) {
      const b = new google.maps.LatLngBounds();
      points.forEach((pt) => b.extend(pt));
      trail?.forEach((pt) => b.extend(pt));
      m.fitBounds(b, 48);
      if (points.length + (trail?.length ?? 0) === 1) m.setZoom(14);
      fitted.current = true;
    }
  }, [ready, points, trail]);

  if (!available) return null;
  return <div ref={el} className={className ?? "h-80 w-full overflow-hidden rounded-xl border border-border bg-muted"} role="region" aria-label="Map" />;
}
