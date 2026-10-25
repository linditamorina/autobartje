"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveInspectionAction, type DriverState } from "@/app/driver/actions";
import { useKeepInputSubmit } from "@/components/admin/use-submit";
import { SignaturePad } from "./signature-pad";

export function InspectionForm({
  orderId,
  kind,
  defaults,
  canSign,
}: {
  orderId: string;
  kind: "PICKUP" | "DELIVERY";
  defaults: { odometerKm: number | null; fuelLevel: number | null; notes: string | null; signerName: string | null };
  canSign: boolean;
}) {
  const t = useTranslations("Driver");
  const [state, action, pending] = useActionState<DriverState, FormData>(saveInspectionAction, undefined);
  const onSubmit = useKeepInputSubmit(action);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-base font-semibold">{t("odometer")}</span>
          <Input name="odometerKm" type="number" inputMode="numeric" min={0} defaultValue={defaults.odometerKm ?? ""} />
        </label>
        <label className="block space-y-1">
          <span className="text-base font-semibold">{t("fuel")}</span>
          <select name="fuelLevel" defaultValue={defaults.fuelLevel ?? ""} className="flex min-h-12 w-full rounded-lg border-2 border-input bg-background px-3 text-base">
            <option value="">–</option>
            {[0, 25, 50, 75, 100].map((v) => <option key={v} value={v}>{v} %</option>)}
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-base font-semibold">{t("damageNotes")}</span>
        <textarea name="notes" rows={3} defaultValue={defaults.notes ?? ""} className="w-full rounded-lg border-2 border-input bg-background p-3 text-base" />
      </label>
      {kind === "DELIVERY" && (
        <fieldset className="space-y-3 rounded-xl border-2 border-border p-3" disabled={!canSign}>
          <legend className="px-1 font-bold">{t("customerSignOff")}</legend>
          {!canSign && <p className="text-base text-muted-foreground">{t("photosFirst")}</p>}
          <label className="block space-y-1">
            <span className="text-base font-semibold">{t("signerName")}</span>
            <Input name="signerName" defaultValue={defaults.signerName ?? ""} autoComplete="off" />
          </label>
          <p className="text-base">{t("signText")}</p>
          <SignaturePad name="signature" />
        </fieldset>
      )}
      <Button type="submit" size="lg" className="min-h-16 w-full text-xl" disabled={pending}>
        {pending ? t("saving") : kind === "DELIVERY" ? t("saveDelivery") : t("savePickup")}
      </Button>
      {state?.error && <p role="alert" className="font-semibold text-destructive">{t(`errors.${state.error}` as never)}</p>}
    </form>
  );
}
