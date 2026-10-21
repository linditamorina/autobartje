"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { resetTwoFactorAction, type UserState } from "@/app/admin/(panel)/users/actions";

export function ResetTwoFactor({ userId }: { userId: string }) {
  const t = useTranslations("Admin.users");
  const [state, action, pending] = useActionState<UserState, FormData>(resetTwoFactorAction, undefined);
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(t("reset2faConfirm"))) e.preventDefault(); }} className="space-y-2">
      <input type="hidden" name="id" value={userId} />
      <Button type="submit" variant="outline" disabled={pending}>{t("reset2fa")}</Button>
      {state?.ok && <p role="status" className="text-sm font-semibold text-success">{t("reset2faDone")}</p>}
      {state?.error && <p role="alert" className="text-sm font-semibold text-destructive">{t(`errors.${state.error}` as never)}</p>}
    </form>
  );
}
