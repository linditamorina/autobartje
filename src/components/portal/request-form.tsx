"use client";

import { startTransition, useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlaceInput } from "@/components/booking/place-input";
import type { Place } from "@/components/booking/draft";
import { requestAction, type RequestState } from "@/app/portal/actions";
import { SERVICES, VEHICLE_TYPES } from "@/lib/validation/booking";
import { cn } from "@/lib/utils";

function Field({ label, children, wide, invalid }: { label: string; children: React.ReactNode; wide?: boolean; invalid?: boolean }) {
  return (
    <label className={cn("block space-y-1", wide && "sm:col-span-2")}>
      <span className={cn("text-sm font-semibold", invalid && "text-destructive")}>{label}</span>
      {children}
    </label>
  );
}

export function RequestForm({ defaults }: { defaults: { contactName: string; contactPhone: string } }) {
  const t = useTranslations("Portal");
  const tsv = useTranslations("Admin.service");
  const tv = useTranslations("Quote.vehicleTypes");
  const [service, setService] = useState<(typeof SERVICES)[number]>("DOMESTIC_TRANSPORT");
  const [pickup, setPickup] = useState<Place | null>(null);
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [asap, setAsap] = useState(false);
  const [state, action, pending] = useActionState<RequestState, FormData>(requestAction, undefined);
  const bad = (path: string) => state?.fields?.some((f) => f === path || f.startsWith(`${path}.`));
  const roadside = service === "ROADSIDE_ASSISTANCE";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    const when = s("pickupAt");
    const payload = {
      quote: {
        service,
        vehicleType: s("vehicleType"),
        isDrivable: f.get("isDrivable") === "on",
        pickup: pickup ?? { address: "", country: "XK" },
        dropoff: roadside ? null : dropoff,
        options: { winch: f.get("winch") === "on", enclosed: f.get("enclosed") === "on", express: f.get("express") === "on" },
        isAsap: asap,
        pickupAt: asap || !when ? null : new Date(when).toISOString(),
      },
      vehicle: { make: s("make"), model: s("model"), plate: s("plate") || null, vin: s("vin") || null },
      customerRef: s("customerRef") || null,
      contactName: s("contactName"),
      contactPhone: s("contactPhone"),
      notes: s("notes") || null,
    };
    const data = new FormData();
    data.set("payload", JSON.stringify(payload));
    // React resets uncontrolled fields after a form action; calling the action directly keeps what was typed.
    startTransition(() => action(data));
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <fieldset className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <legend className="px-1 font-bold">{t("transport")}</legend>
        <Field label={t("service")} wide>
          <select value={service} onChange={(e) => setService(e.target.value as typeof service)} className="flex min-h-12 w-full rounded-lg border-2 border-input bg-background px-3">
            {SERVICES.map((s) => <option key={s} value={s}>{tsv(s)}</option>)}
          </select>
        </Field>
        <div className={cn("sm:col-span-2", bad("quote.pickup") && "text-destructive")}>
          <PlaceInput name="pickup" label={t("pickup")} value={pickup} onChange={setPickup} domestic={service !== "INTERNATIONAL_TRANSPORT"} error={bad("quote.pickup") ? t("required") : undefined} />
        </div>
        {!roadside && (
          <div className="sm:col-span-2">
            <PlaceInput name="dropoff" label={t("dropoff")} value={dropoff} onChange={setDropoff} domestic={service !== "INTERNATIONAL_TRANSPORT"} error={bad("quote.dropoff") ? t("required") : undefined} />
          </div>
        )}
        <label className="flex min-h-12 items-center gap-3 font-semibold">
          <input type="checkbox" checked={asap} onChange={(e) => setAsap(e.target.checked)} className="size-5 accent-primary" /> {t("asap")}
        </label>
        {!asap && (
          <Field label={t("pickupAt")} invalid={bad("quote.pickupAt")}>
            <Input name="pickupAt" type="datetime-local" aria-invalid={bad("quote.pickupAt") || undefined} />
          </Field>
        )}
        <div className="flex flex-wrap gap-x-6 sm:col-span-2">
          {(["winch", "enclosed", "express"] as const).map((o) => (
            <label key={o} className="flex min-h-12 items-center gap-3 font-semibold">
              <input type="checkbox" name={o} className="size-5 accent-primary" /> {t(`options.${o}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <legend className="px-1 font-bold">{t("vehicle")}</legend>
        <Field label={t("vehicleType")}>
          <select name="vehicleType" defaultValue="CAR" className="flex min-h-12 w-full rounded-lg border-2 border-input bg-background px-3">
            {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{tv(v)}</option>)}
          </select>
        </Field>
        <label className="flex min-h-12 items-center gap-3 self-end font-semibold">
          <input type="checkbox" name="isDrivable" defaultChecked className="size-5 accent-primary" /> {t("drivable")}
        </label>
        <Field label={t("make")} invalid={bad("vehicle.make")}><Input name="make" required aria-invalid={bad("vehicle.make") || undefined} /></Field>
        <Field label={t("model")} invalid={bad("vehicle.model")}><Input name="model" required aria-invalid={bad("vehicle.model") || undefined} /></Field>
        <Field label={t("plate")}><Input name="plate" className="uppercase" /></Field>
        <Field label={t("vin")} invalid={bad("vehicle.vin")}><Input name="vin" maxLength={17} className="uppercase" aria-invalid={bad("vehicle.vin") || undefined} /></Field>
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <legend className="px-1 font-bold">{t("contactAndRef")}</legend>
        <Field label={t("customerRef")}><Input name="customerRef" maxLength={60} /></Field>
        <div />
        <Field label={t("contactName")} invalid={bad("contactName")}><Input name="contactName" defaultValue={defaults.contactName} aria-invalid={bad("contactName") || undefined} /></Field>
        <Field label={t("contactPhone")} invalid={bad("contactPhone")}><Input name="contactPhone" type="tel" defaultValue={defaults.contactPhone} aria-invalid={bad("contactPhone") || undefined} /></Field>
        <Field label={t("notes")} wide><textarea name="notes" rows={3} maxLength={2000} className="w-full rounded-lg border-2 border-input bg-background p-3" /></Field>
      </fieldset>

      {state?.error && <p role="alert" className="font-semibold text-destructive">{t(`errors.${state.error}` as never)}</p>}
      <Button type="submit" size="lg" disabled={pending}>{pending ? t("sending") : t("send")}</Button>
    </form>
  );
}
