"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LocateFixed, LocateOff } from "lucide-react";
import { shouldSend, type LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";

type State = "starting" | "sharing" | "denied" | "unavailable" | "stopped";

/**
 * Sends the phone's position while a job is under way, so the office map and the
 * customer's tracking page show the truck. Browsers pause GPS when the screen
 * locks, so the screen is kept on while sharing (where the phone allows it).
 */
export function LocationSharing() {
  const t = useTranslations("Driver.gps");
  const [state, setState] = useState<State>("starting");
  const last = useRef<(LatLng & { at: number }) | null>(null);

  useEffect(() => {
    // Every phone browser has geolocation; without it the bar just stays on "starting".
    if (!("geolocation" in navigator)) return;
    let stopped = false;
    let lock: WakeLockSentinel | null = null;
    const keepAwake = async () => {
      if (stopped || document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Battery saver or an old browser: sharing still works while the screen is on.
      }
    };
    void keepAwake();
    document.addEventListener("visibilitychange", keepAwake);

    const watch = navigator.geolocation.watchPosition(
      async (p) => {
        if (stopped) return;
        setState("sharing");
        const fix = { lat: p.coords.latitude, lng: p.coords.longitude, at: Date.now() };
        if (!shouldSend(last.current, fix)) return;
        last.current = fix;
        try {
          const res = await fetch("/api/driver/location", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              lat: fix.lat,
              lng: fix.lng,
              accuracy: p.coords.accuracy,
              speed: p.coords.speed ?? undefined,
              heading: p.coords.heading != null && !Number.isNaN(p.coords.heading) ? p.coords.heading : undefined,
              at: Math.round(p.timestamp),
            }),
          });
          const data = (await res.json().catch(() => ({}))) as { sharing?: boolean };
          if (data.sharing === false) {
            stopped = true;
            setState("stopped");
            navigator.geolocation.clearWatch(watch);
          }
        } catch {
          // Offline for a moment: the next fix goes out when the connection is back.
          last.current = null;
        }
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );

    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watch);
      document.removeEventListener("visibilitychange", keepAwake);
      void lock?.release().catch(() => {});
    };
  }, []);

  if (state === "stopped") return null;
  const ok = state === "sharing" || state === "starting";
  return (
    <p role="status" data-gps={state} className={cn("flex items-center gap-2 rounded-xl px-4 py-3 text-base font-semibold", ok ? "bg-success/15 text-foreground" : "border-2 border-amber-500 bg-card")}>
      {ok ? <LocateFixed aria-hidden className="size-5 shrink-0 text-success" /> : <LocateOff aria-hidden className="size-5 shrink-0 text-amber-600" />}
      {t(state)}
    </p>
  );
}
