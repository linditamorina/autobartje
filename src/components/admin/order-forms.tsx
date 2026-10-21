"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addNoteAction, changeStatusAction, setPriceAction, type ActionState } from "@/app/admin/(panel)/orders/actions";

function Feedback({ state }: { state: ActionState }) {
  const t = useTranslations("Admin.orders");
  const tc = useTranslations("Admin.common");
  if (!state) return null;
  if (state.ok) return <p role="status" className="text-sm font-semibold text-success">{tc("saved")}</p>;
  const msg = state.error === "priceRequired" ? t("priceRequired") : state.error === "invalidTransition" ? t("invalidTransition") : tc("error");
  return <p role="alert" className="text-sm font-semibold text-destructive">{msg}</p>;
}

export function StatusButtons({ orderId, next, needsPrice, defaultPrice }: { orderId: string; next: string[]; needsPrice: boolean; defaultPrice: string }) {
  const t = useTranslations("Admin.orders");
  const ts = useTranslations("Admin.status");
  const [state, action, pending] = useActionState<ActionState, FormData>(changeStatusAction, undefined);
  if (!next.length) return null;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      {needsPrice && next.includes("CONFIRMED") && (
        <label className="block space-y-1">
          <span className="text-sm font-semibold">{t("finalPrice")}</span>
          <Input name="finalPrice" inputMode="decimal" defaultValue={defaultPrice} />
        </label>
      )}
      {next.includes("CANCELLED") && (
        <label className="block space-y-1">
          <span className="text-sm font-semibold">{t("cancelReason")}</span>
          <Input name="note" />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {next.map((s) => (
          <Button key={s} type="submit" name="to" value={s} variant={s === "CANCELLED" ? "outline" : "default"} disabled={pending}>
            {t("moveTo", { status: ts(s as never) })}
          </Button>
        ))}
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function PriceForm({ orderId, defaultPrice }: { orderId: string; defaultPrice: string }) {
  const t = useTranslations("Admin.orders");
  const [state, action, pending] = useActionState<ActionState, FormData>(setPriceAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="flex-1 space-y-1">
        <span className="text-sm font-semibold">{t("finalPrice")}</span>
        <Input name="finalPrice" inputMode="decimal" defaultValue={defaultPrice} required />
      </label>
      <Button type="submit" variant="secondary" disabled={pending}>{t("savePrice")}</Button>
      <div className="w-full"><Feedback state={state} /></div>
    </form>
  );
}

export function NoteForm({ orderId }: { orderId: string }) {
  const t = useTranslations("Admin.orders");
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, form) => {
    const res = await addNoteAction(prev, form);
    if (res?.ok) ref.current?.reset();
    return res;
  }, undefined);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="sr-only" htmlFor="note-body">{t("addNote")}</label>
      <textarea id="note-body" name="body" required rows={3} placeholder={t("notePlaceholder")} className="w-full rounded-lg border-2 border-input bg-background p-3" />
      <Button type="submit" variant="secondary" disabled={pending}>{t("addNote")}</Button>
      {state?.error && <Feedback state={state} />}
    </form>
  );
}
