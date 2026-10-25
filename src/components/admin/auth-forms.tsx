"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/booking/fields";
import { confirmTotpSetupAction, loginAction, verifyTotpAction, type FormState } from "@/app/admin/(auth)/actions";

function ErrorText({ code, ns }: { code?: string; ns: "login" | "twofa" }) {
  const t = useTranslations(`Admin.${ns}`);
  if (!code) return null;
  return (
    <p role="alert" className="font-semibold text-destructive">
      {t(code as never)}
    </p>
  );
}

export function LoginForm() {
  const t = useTranslations("Admin.login");
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <TextField label={t("email")} name="email" type="email" autoComplete="username" required />
      <TextField label={t("password")} name="password" type="password" autoComplete="current-password" required />
      <ErrorText code={state?.error} ns="login" />
      <Button type="submit" className="w-full" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}

export function TotpForm({ mode }: { mode: "verify" | "setup" }) {
  const t = useTranslations("Admin.twofa");
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "verify" ? verifyTotpAction : confirmTotpSetupAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <TextField label={t("code")} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus className="[&_input]:text-center [&_input]:text-2xl [&_input]:tracking-[0.5em]" />
      <ErrorText code={state?.error} ns="twofa" />
      <Button type="submit" className="w-full" disabled={pending}>
        {mode === "verify" ? t("verify") : t("confirm")}
      </Button>
    </form>
  );
}
