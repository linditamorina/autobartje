"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOrderAction, type ActionState } from "@/app/admin/(panel)/orders/actions";
import { CHANNELS, SERVICES, VEHICLE_TYPES } from "@/lib/validation/booking";
import { Panel } from "./ui";
import { useKeepInputSubmit } from "./use-submit";

const selectClass = "flex min-h-12 w-full rounded-lg border-2 border-input bg-background px-3 py-2 text-base";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

function Check({ name, label, defaultChecked, onChange }: { name: string; label: string; defaultChecked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 items-center gap-3 font-semibold">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} onChange={(e) => onChange?.(e.target.checked)} className="size-5 accent-primary" />
      {label}
    </label>
  );
}

export function ManualOrderForm() {
  const t = useTranslations("Admin.orders");
  const tsv = useTranslations("Admin.service");
  const tch = useTranslations("Admin.channel");
  const tc = useTranslations("Admin.common");
  const tq = useTranslations("Quote");
  const tb = useTranslations("Booking");
  const [asap, setAsap] = useState(true);
  // datetime-local has no zone; send the browser's (Kosovo) time as an ISO instant.
  const [requestedIso, setRequestedIso] = useState("");
  const [state, action, pending] = useActionState<ActionState, FormData>(createOrderAction, undefined);
  const onSubmit = useKeepInputSubmit(action);

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
      <Panel title={t("routeSection")}>
        <div className="space-y-3">
          <Field label={tq("service")}>
            <select name="service" className={selectClass} defaultValue="EMERGENCY_TOWING">
              {SERVICES.map((s) => <option key={s} value={s}>{tsv(s)}</option>)}
            </select>
          </Field>
          <Field label={t("takenVia")}>
            <select name="channel" className={selectClass} defaultValue="PHONE">
              {(["PHONE", "WHATSAPP", "ADMIN"] as const).map((c) => <option key={c} value={c}>{tch(c)}</option>)}
            </select>
          </Field>
          <Check name="urgent" label={t("urgent")} />
          <Field label={t("pickup")}><Input name="pickupAddress" required minLength={3} autoComplete="off" /></Field>
          <Field label={t("dropoff")}><Input name="dropoffAddress" autoComplete="off" /></Field>
          <Check name="isAsap" label={t("asapOrder")} defaultChecked onChange={setAsap} />
          {!asap && (
            <Field label={t("requestedAt")}>
              <Input type="datetime-local" required onChange={(e) => setRequestedIso(e.target.value ? new Date(e.target.value).toISOString() : "")} />
              <input type="hidden" name="requestedAt" value={requestedIso} />
            </Field>
          )}
        </div>
      </Panel>

      <Panel title={t("customerSection")}>
        <div className="space-y-3">
          <Field label={t("fullName")}><Input name="fullName" required minLength={2} autoComplete="off" /></Field>
          <Field label={t("phone")}><Input name="phone" type="tel" required inputMode="tel" placeholder="+383 44 123 456" /></Field>
          <Field label={t("email")}><Input name="email" type="email" /></Field>
          <Field label={tb("preferredChannel")}>
            <select name="preferredChannel" className={selectClass} defaultValue="PHONE">
              {CHANNELS.map((c) => <option key={c} value={c}>{tb(`channels.${c}`)}</option>)}
            </select>
          </Field>
        </div>
      </Panel>

      <Panel title={t("vehicleSection")}>
        <div className="space-y-3">
          <Field label={t("vehicleType")}>
            <select name="vehicleType" className={selectClass} defaultValue="CAR">
              {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{tq(`vehicleTypes.${v}`)}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("make")}><Input name="make" /></Field>
            <Field label={t("model")}><Input name="model" /></Field>
          </div>
          <Field label={t("plate")}><Input name="plate" className="uppercase" /></Field>
          <Check name="isDrivable" label={t("drivable")} />
        </div>
      </Panel>

      <Panel title={t("price")}>
        <div className="space-y-3">
          <Field label={t("finalPrice")}><Input name="finalPrice" inputMode="decimal" /></Field>
          <Field label={t("noteOptional")}>
            <textarea name="note" rows={4} className="w-full rounded-lg border-2 border-input bg-background p-3" />
          </Field>
        </div>
      </Panel>

      <div className="space-y-2 lg:col-span-2">
        {state?.error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {tc("error")} ({state.error})
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {t("create")}
        </Button>
      </div>
    </form>
  );
}
