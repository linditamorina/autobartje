"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookupAction, type LookupState } from "@/app/[locale]/track/actions";
import { useKeepInputSubmit } from "@/components/admin/use-submit";

export function LookupForm({ locale }: { locale: string }) {
  const t = useTranslations("Track");
  const [state, action, pending] = useActionState<LookupState, FormData>(lookupAction, undefined);
  const onSubmit = useKeepInputSubmit(action);
  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <label className="block space-y-1">
        <span className="font-semibold">{t("orderNumber")}</span>
        <Input name="number" required autoComplete="off" placeholder="P-2026-00042" className="uppercase" />
      </label>
      <label className="block space-y-1">
        <span className="font-semibold">{t("phone")}</span>
        <Input name="phone" type="tel" required autoComplete="tel" inputMode="tel" />
      </label>
      <Button type="submit" size="lg" disabled={pending}>{t("find")}</Button>
      {state?.error && <p role="alert" className="font-semibold text-destructive">{t(`errors.${state.error}`)}</p>}
    </form>
  );
}
