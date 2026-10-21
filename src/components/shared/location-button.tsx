"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { mapsLink, whatsappHref } from "@/lib/contact";
import { cn } from "@/lib/utils";

/**
 * Gets the browser location and opens WhatsApp with a prefilled message
 * containing a Google Maps link. Location is only read after the tap.
 */
export function LocationButton({ whatsapp, className, children }: { whatsapp: string; className?: string; children?: React.ReactNode }) {
  const t = useTranslations("ActionBar");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function send() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError(t("locationError"));
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const link = mapsLink(pos.coords.latitude, pos.coords.longitude);
        window.location.href = whatsappHref(whatsapp, t("locationText", { link }));
      },
      () => {
        setBusy(false);
        setError(t("locationError"));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  return (
    <>
      <button type="button" onClick={send} disabled={busy} aria-busy={busy} className={cn(className)}>
        {children ?? (
          <>
            <MapPin aria-hidden />
            <span>{busy ? t("locating") : t("location")}</span>
          </>
        )}
      </button>
      {error && (
        <p role="alert" className="fixed inset-x-4 bottom-24 z-50 rounded-lg bg-destructive p-3 text-sm font-semibold text-destructive-foreground md:bottom-6">
          {error}
        </p>
      )}
    </>
  );
}
