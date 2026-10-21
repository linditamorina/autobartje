"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KOSOVO_BOUNDS, loadGoogleMaps } from "./google-maps";
import type { Place } from "./draft";

interface Props {
  label: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
  /** Restrict suggestions to Kosovo. */
  domestic?: boolean;
  allowMyLocation?: boolean;
  error?: string;
  name: string;
}

/**
 * Address field. With a Google Maps key it uses Places Autocomplete
 * (PlaceAutocompleteElement) to get coordinates; without one it is a plain
 * text field and the price is confirmed by the operator.
 */
export function PlaceInput({ label, value, onChange, domestic = true, allowMyLocation, error, name }: Props) {
  const t = useTranslations("Quote");
  const locale = useLocale();
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const [google, setGoogle] = useState(false);
  const [locating, setLocating] = useState(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const loader = loadGoogleMaps(locale);
    if (!loader || !host.current) return;
    let el: google.maps.places.PlaceAutocompleteElement | null = null;
    let cancelled = false;
    loader
      .then(async (maps) => {
        const { PlaceAutocompleteElement } = (await maps.importLibrary("places")) as google.maps.PlacesLibrary;
        if (cancelled || !host.current) return;
        el = new PlaceAutocompleteElement(domestic ? { locationRestriction: KOSOVO_BOUNDS } : {});
        el.id = id;
        el.setAttribute("aria-label", label);
        el.style.width = "100%";
        el.addEventListener("gmp-select", async (event) => {
          const place = (event as unknown as { placePrediction: google.maps.places.PlacePrediction }).placePrediction.toPlace();
          await place.fetchFields({ fields: ["formattedAddress", "location", "addressComponents", "displayName"] });
          const comp = (type: string) => place.addressComponents?.find((c) => c.types.includes(type));
          onChangeRef.current({
            address: place.formattedAddress ?? place.displayName ?? "",
            lat: place.location?.lat() ?? null,
            lng: place.location?.lng() ?? null,
            country: comp("country")?.shortText ?? "XK",
            city: comp("locality")?.longText ?? null,
          });
        });
        host.current.replaceChildren(el);
        setGoogle(true);
      })
      .catch(() => setGoogle(false));
    return () => {
      cancelled = true;
      el?.remove();
    };
  }, [domestic, id, label, locale]);

  function useMyLocation() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        onChange({ address: `${t("useMyLocation")} (${lat.toFixed(5)}, ${lng.toFixed(5)})`, lat, lng, country: "XK", city: null });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div ref={host} className={google ? "" : "hidden"} />
      {google && value?.address && <p className="text-sm text-muted-foreground">{value.address}</p>}
      {!google && (
        <Input
          id={id}
          name={name}
          autoComplete="street-address"
          placeholder={t("pickupPlaceholder")}
          value={value?.address ?? ""}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.value ? { address: e.target.value, lat: null, lng: null, country: "XK", city: null } : null)}
        />
      )}
      {allowMyLocation && (
        <button type="button" onClick={useMyLocation} disabled={locating} className="inline-flex min-h-12 items-center gap-2 font-semibold text-primary underline underline-offset-4">
          <LocateFixed aria-hidden className="size-5" /> {locating ? "…" : t("useMyLocation")}
        </button>
      )}
      {error && (
        <p id={errorId} className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
