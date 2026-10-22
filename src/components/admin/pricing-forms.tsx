"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { simulateAction, updateRuleAction, type PricingState, type SimState } from "@/app/admin/(panel)/pricing/actions";
import { ORIGIN_COUNTRIES, SERVICES, VEHICLE_TYPES } from "@/lib/validation/booking";
import { formatEur } from "@/lib/money";
import { useKeepInputSubmit } from "./use-submit";

const selectClass = "flex min-h-12 w-full rounded-lg border-2 border-input bg-background px-3 py-2 text-base";

export interface RuleRowData {
  id: string;
  name: string;
  kind: string;
  /** Display value: euros or percent. */
  amount: string;
  isActive: boolean;
  scope: string;
  fromHour?: number;
  toHour?: number;
  minKm?: number;
  hasHours: boolean;
  hasMinKm: boolean;
}

export function RuleRow({ rule, editable }: { rule: RuleRowData; editable: boolean }) {
  const t = useTranslations("Admin.pricing");
  const tc = useTranslations("Admin.common");
  const [state, action, pending] = useActionState<PricingState, FormData>(updateRuleAction, undefined);
  const onSubmit = useKeepInputSubmit(action);
  const bad = new Set(state?.fields ?? []);
  return (
    <form onSubmit={onSubmit} className="grid gap-2 py-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
      <input type="hidden" name="id" value={rule.id} />
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">{t(`kinds.${rule.kind}` as never)} · {rule.scope}</span>
        <Input name="name" defaultValue={rule.name} disabled={!editable} aria-invalid={bad.has("name") || undefined} aria-label={t("name")} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">{t("amount")}</span>
        <Input name="amount" inputMode="decimal" defaultValue={rule.amount} disabled={!editable} aria-invalid={bad.has("amount") || undefined} className="text-right tabular-nums" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="isActive" defaultChecked={rule.isActive} disabled={!editable} className="size-5 accent-primary" />
          {t("active")}
        </label>
        {editable && <Button type="submit" variant="secondary" size="sm" disabled={pending}>{t("save")}</Button>}
      </div>
      {(rule.hasHours || rule.hasMinKm) && (
        <div className="flex flex-wrap gap-2 sm:col-span-3">
          {rule.hasHours && (
            <>
              <label className="flex items-center gap-2 text-sm">{t("fromHour")}<Input name="fromHour" type="number" min={0} max={23} defaultValue={rule.fromHour} disabled={!editable} className="w-20" /></label>
              <label className="flex items-center gap-2 text-sm">{t("toHour")}<Input name="toHour" type="number" min={0} max={23} defaultValue={rule.toHour} disabled={!editable} className="w-20" /></label>
            </>
          )}
          {rule.hasMinKm && <label className="flex items-center gap-2 text-sm">{t("minKm")}<Input name="minKm" type="number" min={0} defaultValue={rule.minKm} disabled={!editable} className="w-24" /></label>}
        </div>
      )}
      {state?.ok && <p role="status" className="text-sm font-semibold text-success sm:col-span-3">{tc("saved")}</p>}
      {state?.error && <p role="alert" className="text-sm font-semibold text-destructive sm:col-span-3">{state.error === "invalid" ? tc("invalid") : tc("error")}</p>}
    </form>
  );
}

export function PriceSimulator() {
  const t = useTranslations("Admin.pricing");
  const tq = useTranslations("Quote");
  const tsv = useTranslations("Admin.service");
  const tc = useTranslations("Admin.common");
  const locale = useLocale();
  const [state, action, pending] = useActionState<SimState, FormData>(simulateAction, undefined);
  const onSubmit = useKeepInputSubmit(action);
  const r = state?.result;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1"><span className="text-sm font-semibold">{t("service")}</span>
            <select name="service" className={selectClass} defaultValue="EMERGENCY_TOWING">{SERVICES.map((s) => <option key={s} value={s}>{tsv(s)}</option>)}</select>
          </label>
          <label className="block space-y-1"><span className="text-sm font-semibold">{t("vehicle")}</span>
            <select name="vehicleType" className={selectClass} defaultValue="CAR">{VEHICLE_TYPES.map((v) => <option key={v} value={v}>{tq(`vehicleTypes.${v}`)}</option>)}</select>
          </label>
          <label className="block space-y-1"><span className="text-sm font-semibold">{t("distance")}</span><Input name="distanceKm" inputMode="decimal" defaultValue="25" /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold">{t("pickupAt")}</span><Input name="pickupAt" type="datetime-local" /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold">{t("from")}</span>
            <select name="fromCountry" className={selectClass} defaultValue="DE">{ORIGIN_COUNTRIES.map((c) => <option key={c} value={c}>{tq(`countries.${c}`)}</option>)}</select>
          </label>
          <label className="block space-y-1"><span className="text-sm font-semibold">{t("fromCity")}</span><Input name="fromCity" /></label>
        </div>
        <fieldset className="grid gap-1 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-semibold">{t("options")}</legend>
          <label className="flex min-h-10 items-center gap-2"><input type="checkbox" name="isDrivable" defaultChecked className="size-5 accent-primary" />{t("drivable")}</label>
          {(["enclosed", "express", "winch", "highway", "customs", "exportPlates"] as const).map((o) => (
            <label key={o} className="flex min-h-10 items-center gap-2"><input type="checkbox" name={o} className="size-5 accent-primary" />{tq(`optionLabels.${o}`)}</label>
          ))}
        </fieldset>
        <Button type="submit" disabled={pending}>{t("calculate")}</Button>
      </form>
      <div aria-live="polite">
        {state?.error && <p role="alert" className="font-semibold text-destructive">{tc("invalid")}</p>}
        {r && !r.ok && <p role="alert" className="font-semibold text-destructive">{r.reason === "no_route_tariff" ? t("noTariff") : t("noBase")}</p>}
        {r?.ok && (
          <table className="w-full text-sm" data-testid="sim-result">
            <tbody>
              {r.lines.map((l, i) => (
                <tr key={`${l.key}-${i}`} className="border-b border-border">
                  <td className="py-1.5">{l.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatEur(l.cents, locale)}</td>
                </tr>
              ))}
              <tr><td className="pt-2">{t("net")}</td><td className="pt-2 text-right tabular-nums">{formatEur(r.netCents, locale)}</td></tr>
              <tr><td>{t("vat")}</td><td className="text-right tabular-nums">{formatEur(r.vatCents, locale)}</td></tr>
              <tr className="text-lg font-extrabold"><td>{t("total")}</td><td className="text-right tabular-nums">{formatEur(r.totalCents, locale)}</td></tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
