"use client";

import { useTranslations } from "next-intl";
import { ORIGIN_COUNTRIES, SERVICES, VEHICLE_TYPES } from "@/lib/validation/booking";
import { ChoiceGroup, CheckField, SelectField, TextField } from "./fields";
import { PlaceInput } from "./place-input";
import type { Draft } from "./draft";

export type DraftErrors = Partial<Record<string, string>>;

const OPTION_KEYS = ["enclosed", "express", "winch", "highway", "customs", "exportPlates"] as const;

/** Service, route, vehicle type, drivability and extras: shared by the quote page and booking step 1. */
export function QuoteFields({ draft, update, errors }: { draft: Draft; update: (patch: Partial<Draft>) => void; errors: DraftErrors }) {
  const t = useTranslations("Quote");
  const intl = draft.service === "INTERNATIONAL_TRANSPORT";
  const roadside = draft.service === "ROADSIDE_ASSISTANCE";
  const visibleOptions = OPTION_KEYS.filter((k) => (intl ? ["enclosed", "customs", "exportPlates"].includes(k) : !["customs", "exportPlates"].includes(k)));

  return (
    <div className="space-y-6">
      <ChoiceGroup
        legend={t("service")}
        name="service"
        value={draft.service}
        onChange={(service) => update({ service, isAsap: service === "EMERGENCY_TOWING" || service === "ROADSIDE_ASSISTANCE" })}
        options={SERVICES.map((s) => ({ value: s, label: t(`services.${s}`) }))}
      />

      {intl ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={t("fromCountry")}
            name="fromCountry"
            value={draft.fromCountry}
            onChange={(fromCountry) => update({ fromCountry })}
            options={ORIGIN_COUNTRIES.map((c) => ({ value: c, label: t(`countries.${c}`) }))}
          />
          <TextField label={t("fromCity")} name="fromCity" value={draft.fromCity} onChange={(e) => update({ fromCity: e.target.value })} error={errors.fromCity} autoComplete="address-level2" />
          <div className="sm:col-span-2">
            <PlaceInput label={t("toCity")} name="dropoff" value={draft.dropoff} onChange={(dropoff) => update({ dropoff })} error={errors.dropoff} />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <PlaceInput label={t("pickup")} name="pickup" value={draft.pickup} onChange={(pickup) => update({ pickup })} allowMyLocation error={errors.pickup} />
          {!roadside && <PlaceInput label={t("dropoff")} name="dropoff" value={draft.dropoff} onChange={(dropoff) => update({ dropoff })} error={errors.dropoff} />}
        </div>
      )}

      <ChoiceGroup
        legend={t("vehicleType")}
        name="vehicleType"
        columns={3}
        value={draft.vehicleType}
        onChange={(vehicleType) => update({ vehicleType })}
        options={VEHICLE_TYPES.map((v) => ({ value: v, label: t(`vehicleTypes.${v}`) }))}
      />

      <ChoiceGroup
        legend={t("drivable")}
        name="drivable"
        value={draft.isDrivable ? "yes" : "no"}
        onChange={(v) => update({ isDrivable: v === "yes" })}
        options={[
          { value: "yes", label: t("yes") },
          { value: "no", label: t("no") },
        ]}
      />

      <fieldset>
        <legend className="mb-1 text-sm font-semibold">{t("options")}</legend>
        <div className="grid sm:grid-cols-2">
          {visibleOptions.map((k) => (
            <CheckField key={k} label={t(`optionLabels.${k}`)} checked={draft.options[k]} onChange={(v) => update({ options: { ...draft.options, [k]: v } })} />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/** ASAP vs scheduled time, or a date window for international transport. */
export function TimeFields({ draft, update, errors }: { draft: Draft; update: (patch: Partial<Draft>) => void; errors: DraftErrors }) {
  const t = useTranslations("Quote");
  const now = new Date();
  const min = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  if (draft.service === "INTERNATIONAL_TRANSPORT") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("windowStart")} type="date" name="windowStart" min={min.slice(0, 10)} value={draft.windowStart.slice(0, 10)} onChange={(e) => update({ windowStart: e.target.value })} error={errors.pickupAt ?? errors.windowStart} />
        <TextField label={t("windowEnd")} type="date" name="windowEnd" min={draft.windowStart.slice(0, 10) || min.slice(0, 10)} value={draft.windowEnd.slice(0, 10)} onChange={(e) => update({ windowEnd: e.target.value })} error={errors.windowEnd} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <ChoiceGroup
        legend={t("when")}
        name="when"
        value={draft.isAsap ? "asap" : "scheduled"}
        onChange={(v) => update({ isAsap: v === "asap" })}
        options={[
          { value: "asap", label: t("asap") },
          { value: "scheduled", label: t("scheduled") },
        ]}
      />
      {!draft.isAsap && (
        <TextField label={t("pickupAt")} type="datetime-local" name="pickupAt" min={min} value={draft.pickupAt} onChange={(e) => update({ pickupAt: e.target.value })} error={errors.pickupAt} />
      )}
    </div>
  );
}
