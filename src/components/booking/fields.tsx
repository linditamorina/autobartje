"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Large, tap-friendly radio options rendered as cards. */
export function ChoiceGroup<T extends string>({
  legend,
  value,
  options,
  onChange,
  columns = 2,
  name,
}: {
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  columns?: 2 | 3;
  name: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className={cn("grid gap-2", columns === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-2 font-semibold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring",
              value === o.value ? "border-primary bg-primary/10" : "border-border",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="size-5 accent-[var(--primary)]" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CheckField({ label, checked, onChange, error, children }: { label?: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; error?: string; children?: React.ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex min-h-12 cursor-pointer items-start gap-3 py-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-e` : undefined}
          className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
        />
        <span>{label ?? children}</span>
      </label>
      {error && (
        <p id={`${id}-e`} className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  error,
  help,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; help?: string }) {
  const id = useId();
  const describedBy = [error && `${id}-e`, help && `${id}-h`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
      {help && (
        <p id={`${id}-h`} className="text-sm text-muted-foreground">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-e`} className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  name,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  name: string;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex min-h-12 w-full rounded-lg border-2 border-input bg-background px-3 text-base focus-visible:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
