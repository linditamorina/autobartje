"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useKeepInputSubmit } from "./use-submit";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "email" | "tel" | "password" | "checkbox" | "select" | "textarea";
  options?: { value: string; label: string }[];
  defaultValue?: string | number | boolean | null;
  required?: boolean;
  help?: string;
  step?: string;
  /** Spans both columns on wide screens. */
  wide?: boolean;
};

export type FormState = { ok?: boolean; error?: string; fields?: string[] } | undefined;

/**
 * Declarative admin form for simple records (trucks, drivers, tariffs...).
 * The server action returns which fields failed; those get aria-invalid.
 */
export function FieldsForm({
  action,
  fields,
  hidden,
  submitLabel,
  errors,
  resetOnSuccess,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  fields: FieldDef[];
  hidden?: Record<string, string>;
  submitLabel: string;
  /** Messages for error codes the action may return, besides "invalid". */
  errors?: Record<string, string>;
  resetOnSuccess?: boolean;
}) {
  const tc = useTranslations("Admin.common");
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const res = await action(prev, form);
    if (res?.ok && resetOnSuccess) ref.current?.reset();
    return res;
  }, undefined);
  const onSubmit = useKeepInputSubmit(formAction);
  const invalid = new Set(state?.fields ?? []);

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const common = { name: f.name, required: f.required, "aria-invalid": invalid.has(f.name) || undefined };
          if (f.type === "checkbox") {
            return (
              <label key={f.name} className={cn("flex min-h-12 items-center gap-3 font-semibold", f.wide && "sm:col-span-2")}>
                <input type="checkbox" name={f.name} defaultChecked={Boolean(f.defaultValue)} className="size-5 accent-primary" />
                {f.label}
              </label>
            );
          }
          return (
            <label key={f.name} className={cn("block space-y-1", f.wide && "sm:col-span-2")}>
              <span className="text-sm font-semibold">{f.label}{f.required && <span aria-hidden> *</span>}</span>
              {f.type === "select" ? (
                <select {...common} defaultValue={String(f.defaultValue ?? "")} className="flex min-h-12 w-full rounded-lg border-2 border-input bg-background px-3 py-2 text-base aria-invalid:border-destructive">
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea {...common} defaultValue={String(f.defaultValue ?? "")} rows={3} className="w-full rounded-lg border-2 border-input bg-background p-3 aria-invalid:border-destructive" />
              ) : (
                <Input {...common} type={f.type ?? "text"} step={f.step} defaultValue={f.defaultValue == null ? "" : String(f.defaultValue)} autoComplete={f.type === "password" ? "new-password" : "off"} />
              )}
              {f.help && <span className="block text-xs text-muted-foreground">{f.help}</span>}
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{submitLabel}</Button>
        {state?.ok && <p role="status" className="text-sm font-semibold text-success">{tc("saved")}</p>}
        {state?.error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {errors?.[state.error] ?? (state.error === "invalid" ? tc("invalid") : tc("error"))}
          </p>
        )}
      </div>
    </form>
  );
}
