"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { monthlyInvoiceAction, type CustomerState } from "@/app/admin/(panel)/customers/actions";

export function MonthlyInvoiceForm({ companyId, months }: { companyId: string; months: { month: string; count: number }[] }) {
  const t = useTranslations("Admin.customers");
  const ti = useTranslations("Admin.invoices");
  const [state, action, pending] = useActionState<CustomerState, FormData>(monthlyInvoiceAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="companyId" value={companyId} />
      <label className="block space-y-1">
        <span className="text-sm font-semibold">{t("month")}</span>
        <select name="month" defaultValue={months.find((m) => m.count > 0)?.month ?? months[0].month} className="flex min-h-12 w-full rounded-lg border-2 border-input bg-background px-3">
          {months.map((m) => <option key={m.month} value={m.month}>{t("monthOption", { month: m.month, count: m.count })}</option>)}
        </select>
      </label>
      <Button type="submit" variant="secondary" disabled={pending}>{t("createMonthly")}</Button>
      {state?.error && <p role="alert" className="text-sm font-semibold text-destructive">{ti.has(`errors.${state.error}`) ? ti(`errors.${state.error}` as never) : t("monthlyEmpty")}</p>}
    </form>
  );
}
