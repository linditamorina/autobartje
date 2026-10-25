"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type State = { ok?: boolean; error?: string } | undefined;

/** A one-click server action (delete, reset...) that asks before it runs. */
export function ConfirmButton({
  action,
  hidden,
  label,
  confirm: question,
  variant = "outline",
}: {
  action: (state: State, form: FormData) => Promise<State>;
  hidden: Record<string, string>;
  label: string;
  confirm: string;
  variant?: "outline" | "emergency";
}) {
  const tc = useTranslations("Admin.common");
  const [state, formAction, pending] = useActionState<State, FormData>(action, undefined);
  return (
    <form action={formAction} onSubmit={(e) => { if (!window.confirm(question)) e.preventDefault(); }} className="inline-flex flex-wrap items-center gap-2">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Button type="submit" variant={variant} disabled={pending}>{label}</Button>
      {state?.error && <span role="alert" className="text-sm font-semibold text-destructive">{tc("error")}</span>}
    </form>
  );
}
