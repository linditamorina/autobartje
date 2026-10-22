"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordCashAction, type DriverState } from "@/app/driver/actions";
import { useKeepInputSubmit } from "@/components/admin/use-submit";

export function CashForm({ orderId, suggestedEur }: { orderId: string; suggestedEur: string }) {
  const t = useTranslations("Driver");
  const [state, action, pending] = useActionState<DriverState, FormData>(recordCashAction, undefined);
  const onSubmit = useKeepInputSubmit(action);
  return (
    <form onSubmit={(e) => { if (!window.confirm(t("cashConfirm"))) return e.preventDefault(); onSubmit(e); }} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="block space-y-1">
        <span className="text-base font-semibold">{t("cashAmount")}</span>
        <Input name="amount" inputMode="decimal" defaultValue={suggestedEur} required />
      </label>
      <Button type="submit" variant="outline" size="lg" className="w-full" disabled={pending}>{t("cashReceived")}</Button>
      {state?.ok && <p role="status" className="font-semibold text-success">{t("cashSaved")}</p>}
      {state?.error && <p role="alert" className="font-semibold text-destructive">{t(`errors.${state.error}` as never)}</p>}
    </form>
  );
}
