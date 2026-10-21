"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assignAction, type AssignState } from "@/app/admin/(panel)/dispatch/actions";
import { useKeepInputSubmit } from "./use-submit";

const selectClass = "flex min-h-12 w-full rounded-lg border-2 border-input bg-background px-3 py-2 text-base";

export interface AssignFormProps {
  orderId: string;
  drivers: { id: string; name: string }[];
  trucks: { id: string; label: string }[];
  /** Business-time "YYYY-MM-DDTHH:mm". */
  defaultStart: string;
  defaultDurationMin: number;
  current?: { driverId: string; truckId: string };
  compact?: boolean;
}

export function AssignForm({ orderId, drivers, trucks, defaultStart, defaultDurationMin, current, compact }: AssignFormProps) {
  const t = useTranslations("Admin.dispatch");
  const tc = useTranslations("Admin.common");
  const [state, action, pending] = useActionState<AssignState, FormData>(assignAction, undefined);
  // Changing any field invalidates a previous "assign anyway" confirmation.
  const [dirty, setDirty] = useState(0);
  const submit = useKeepInputSubmit((f) => {
    setDirty(0);
    action(f);
  });
  const conflicts = state?.conflicts ?? [];
  const onlyWarnings = conflicts.length > 0 && conflicts.every((c) => c.severity === "warn");
  const showForce = onlyWarnings && dirty === 0;

  return (
    <form onSubmit={submit} onChange={() => setDirty((n) => n + 1)} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <div className={compact ? "grid gap-2 sm:grid-cols-2" : "space-y-3"}>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">{t("driver")}</span>
          <select name="driverId" required defaultValue={current?.driverId ?? ""} className={selectClass}>
            <option value="" disabled>{t("choose")}</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">{t("truck")}</span>
          <select name="truckId" required defaultValue={current?.truckId ?? ""} className={selectClass}>
            <option value="" disabled>{t("choose")}</option>
            {trucks.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">{t("start")}</span>
          <Input type="datetime-local" name="start" required defaultValue={defaultStart} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">{t("duration")}</span>
          <Input type="number" name="durationMin" required min={15} step={15} defaultValue={defaultDurationMin} />
        </label>
      </div>

      {conflicts.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-3 text-sm">
          {conflicts.map((c) => (
            <li key={c.code} className={c.severity === "block" ? "font-semibold text-destructive" : "font-semibold text-amber-800 dark:text-amber-300"}>
              {c.severity === "block" ? "⛔ " : "⚠️ "}
              {t(`conflicts.${c.code}`)}
              {c.ref && ` (${c.ref})`}
            </li>
          ))}
        </ul>
      )}
      {state?.error && state.error !== "conflicts" && (
        <p role="alert" className="text-sm font-semibold text-destructive">{state.error === "order_closed" ? t("orderClosed") : tc("error")}</p>
      )}
      {state?.ok && <p role="status" className="text-sm font-semibold text-success">{t("assigned")}</p>}

      <div className="flex flex-wrap gap-2">
        {showForce ? (
          <Button type="submit" name="force" value="1" variant="outline" disabled={pending}>{t("assignAnyway")}</Button>
        ) : (
          <Button type="submit" disabled={pending}>{current ? t("reassign") : t("assign")}</Button>
        )}
      </div>
    </form>
  );
}
