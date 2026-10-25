"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { addWebhookAction, createApiKeyAction, type SecretState } from "@/app/admin/(panel)/customers/actions";

/** Shows a key or signing secret once, with a copy button. It cannot be shown again. */
function OneTimeSecret({ value, label }: { value: string; label: string }) {
  const t = useTranslations("Admin.api");
  const [copied, setCopied] = useState(false);
  return (
    <div role="status" className="space-y-2 rounded-lg border-2 border-amber-500 p-3">
      <p className="text-sm font-semibold">{label}</p>
      <input readOnly value={value} aria-label={label} data-testid="one-time-secret" className="w-full rounded-lg border border-input bg-muted px-2 py-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button
        type="button"
        variant="outline"
        onClick={() => navigator.clipboard?.writeText(value).then(() => setCopied(true)).catch(() => {})}
      >
        {copied ? t("copied") : t("copy")}
      </Button>
    </div>
  );
}

export function NewApiKeyForm({ companyId }: { companyId: string }) {
  const t = useTranslations("Admin.api");
  const [state, action, pending] = useActionState<SecretState, FormData>(createApiKeyAction, undefined);
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="companyId" value={companyId} />
        <label className="min-w-48 flex-1 text-sm">
          <span className="block font-semibold">{t("keyName")}</span>
          <input name="name" required minLength={2} maxLength={60} placeholder={t("keyNamePlaceholder")} className="min-h-12 w-full rounded-lg border-2 border-input bg-background px-3" />
        </label>
        <Button type="submit" disabled={pending}>{t("createKey")}</Button>
      </form>
      {state?.error && <p role="alert" className="text-sm font-semibold text-destructive">{t("errors.invalid")}</p>}
      {state?.secret && <OneTimeSecret value={state.secret} label={t("keyOnce")} />}
    </div>
  );
}

export function NewWebhookForm({ companyId, events }: { companyId: string; events: readonly string[] }) {
  const t = useTranslations("Admin.api");
  const [state, action, pending] = useActionState<SecretState, FormData>(addWebhookAction, undefined);
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-2">
        <input type="hidden" name="companyId" value={companyId} />
        <label className="block text-sm">
          <span className="block font-semibold">{t("webhookUrl")}</span>
          <input name="url" type="url" required placeholder="https://" className="min-h-12 w-full rounded-lg border-2 border-input bg-background px-3" />
        </label>
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="sr-only">{t("events")}</legend>
          {events.map((e) => (
            <label key={e} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="events" value={e} defaultChecked className="size-5" /> <code>{e}</code>
            </label>
          ))}
        </fieldset>
        <Button type="submit" disabled={pending}>{t("addWebhook")}</Button>
      </form>
      {state?.error && <p role="alert" className="text-sm font-semibold text-destructive">{t(`errors.${state.error}` as never)}</p>}
      {state?.secret && <OneTimeSecret value={state.secret} label={t("secretOnce")} />}
    </div>
  );
}
