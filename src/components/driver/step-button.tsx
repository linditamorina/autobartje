"use client";

import { startTransition, useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { advanceAction, type DriverState } from "@/app/driver/actions";
import { currentPosition } from "./geo";

/** The big "next step" button. Adds the phone's position to the status change when it can. */
export function StepButton({ orderId, to, label, disabled }: { orderId: string; to: string; label: string; disabled?: boolean }) {
  const t = useTranslations("Driver");
  const [state, action, pending] = useActionState<DriverState, FormData>(advanceAction, undefined);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const pos = await currentPosition();
    if (pos) {
      data.set("lat", String(pos.lat));
      data.set("lng", String(pos.lng));
    }
    startTransition(() => action(data));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="to" value={to} />
      <Button type="submit" size="lg" className="min-h-16 w-full text-xl" disabled={pending || disabled}>
        {pending ? t("saving") : label}
      </Button>
      {state?.error && <p role="alert" className="font-semibold text-destructive">{t(`errors.${state.error}` as never)}</p>}
    </form>
  );
}
