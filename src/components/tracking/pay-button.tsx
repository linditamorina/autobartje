"use client";

import { useActionState } from "react";
import { CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { payAction, type PayState } from "@/app/[locale]/track/actions";

export function PayButton({ token, amount }: { token: string; amount: string }) {
  const t = useTranslations("Track");
  const [state, action, pending] = useActionState<PayState, FormData>(payAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        <CreditCard aria-hidden /> {pending ? t("payOpening") : t("pay", { amount })}
      </Button>
      {state?.error && <p role="alert" className="font-semibold text-destructive">{t(`payErrors.${state.error}`)}</p>}
    </form>
  );
}
