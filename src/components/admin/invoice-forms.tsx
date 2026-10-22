"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { creditAction, issueAction, saveDraftAction, type InvoiceState } from "@/app/admin/(panel)/invoices/actions";
import { calculateInvoice } from "@/server/invoicing/calc";
import { formatEur } from "@/lib/money";
import { useKeepInputSubmit } from "./use-submit";

type Line = { key: number; description: string; quantity: string; unit: string; unitPrice: string; vatRate: string };
export type DraftData = {
  id: string;
  buyer: { name: string; nui: string; address: string; city: string; email: string; phone: string };
  lines: Omit<Line, "key">[];
  pricesIncludeVat: boolean;
};

const num = (s: string) => Number(s.replace(",", "."));

function Message({ state }: { state: InvoiceState }) {
  const t = useTranslations("Admin.invoices");
  const tc = useTranslations("Admin.common");
  if (!state) return null;
  if (state.ok) return <p role="status" className="text-sm font-semibold text-success">{tc("saved")}</p>;
  const known = ["not_draft", "no_lines", "no_price", "exists", "not_issued", "overpaid", "no_buyer"];
  return <p role="alert" className="text-sm font-semibold text-destructive">{state.error && known.includes(state.error) ? t(`errors.${state.error}` as never) : state.error === "invalid" ? tc("invalid") : tc("error")}</p>;
}

export function DraftEditor({ draft }: { draft: DraftData }) {
  const t = useTranslations("Admin.invoices");
  const locale = useLocale();
  const [lines, setLines] = useState<Line[]>(draft.lines.map((l, i) => ({ ...l, key: i })));
  const [inclVat, setInclVat] = useState(draft.pricesIncludeVat);
  const [state, action, pending] = useActionState<InvoiceState, FormData>(saveDraftAction, undefined);
  const onSubmit = useKeepInputSubmit(action);
  const bad = new Set(state?.fields ?? []);
  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  let totals: ReturnType<typeof calculateInvoice> | null = null;
  try {
    const valid = lines.filter((l) => l.description.trim() && num(l.quantity) > 0 && Number.isFinite(num(l.unitPrice)));
    totals = valid.length ? calculateInvoice(valid.map((l) => ({ description: l.description, quantity: num(l.quantity), unitPriceCents: Math.round(num(l.unitPrice) * 100), vatRateBp: Math.round(num(l.vatRate) * 100) })), { pricesIncludeVat: inclVat }) : null;
  } catch {
    totals = null;
  }

  const field = (name: keyof DraftData["buyer"], label: string, type = "text") => (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      <Input name={`buyer.${name}`} type={type} defaultValue={draft.buyer[name]} aria-invalid={bad.has(`buyer.${name}`) || undefined} />
    </label>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={draft.id} />
      <input type="hidden" name="lineCount" value={lines.length} />
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-lg font-bold">{t("buyer")}</legend>
        {field("name", t("buyerName"))}
        {field("nui", t("buyerNui"))}
        {field("address", t("address"))}
        {field("city", t("city"))}
        {field("email", t("email"), "email")}
        {field("phone", t("phone"), "tel")}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-lg font-bold">{t("lines")}</legend>
        <label className="flex min-h-12 items-center gap-3 font-semibold">
          <input type="checkbox" name="pricesIncludeVat" checked={inclVat} onChange={(e) => setInclVat(e.target.checked)} className="size-5 accent-primary" />
          {t("pricesIncludeVat")}
        </label>
        {lines.map((l, i) => (
          <div key={l.key} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_5rem_5rem_7rem_4.5rem_auto] sm:items-end">
            <label className="block space-y-1">
              <span className="text-xs font-semibold">{t("description")}</span>
              <Input name={`line${i}.description`} value={l.description} onChange={(e) => set(l.key, { description: e.target.value })} aria-invalid={bad.has(`line${i}.description`) || undefined} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">{t("quantity")}</span>
              <Input name={`line${i}.quantity`} inputMode="decimal" value={l.quantity} onChange={(e) => set(l.key, { quantity: e.target.value })} aria-invalid={bad.has(`line${i}.quantity`) || undefined} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">{t("unit")}</span>
              <Input name={`line${i}.unit`} value={l.unit} onChange={(e) => set(l.key, { unit: e.target.value })} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">{inclVat ? t("unitPriceGross") : t("unitPrice")}</span>
              <Input name={`line${i}.unitPrice`} inputMode="decimal" value={l.unitPrice} onChange={(e) => set(l.key, { unitPrice: e.target.value })} aria-invalid={bad.has(`line${i}.unitPrice`) || undefined} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">{t("vatRate")}</span>
              <Input name={`line${i}.vatRate`} inputMode="decimal" value={l.vatRate} onChange={(e) => set(l.key, { vatRate: e.target.value })} />
            </label>
            <Button type="button" variant="ghost" size="icon" aria-label={t("removeLine")} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} disabled={lines.length === 1}>
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { key: Math.max(0, ...ls.map((x) => x.key)) + 1, description: "", quantity: "1", unit: "copë", unitPrice: "", vatRate: "18" }])}>
          <Plus aria-hidden /> {t("addLine")}
        </Button>
      </fieldset>

      {totals && (
        <dl className="ml-auto grid max-w-xs grid-cols-2 gap-1 text-right tabular-nums" data-testid="draft-totals">
          <dt>{t("net")}</dt><dd>{formatEur(totals.subtotalCents, locale)}</dd>
          <dt>{t("vat")}</dt><dd>{formatEur(totals.vatCents, locale)}</dd>
          <dt className="font-bold">{t("total")}</dt><dd className="font-bold">{formatEur(totals.totalCents, locale)}</dd>
        </dl>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>{t("saveDraft")}</Button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function IssueButton({ id }: { id: string }) {
  const t = useTranslations("Admin.invoices");
  const [state, action, pending] = useActionState<InvoiceState, FormData>(issueAction, undefined);
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(t("issueConfirm"))) e.preventDefault(); }} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" disabled={pending}>{t("issue")}</Button>
      <p className="text-xs text-muted-foreground">{t("issueHelp")}</p>
      <Message state={state} />
    </form>
  );
}

export function CreditButton({ id }: { id: string }) {
  const t = useTranslations("Admin.invoices");
  const [state, action, pending] = useActionState<InvoiceState, FormData>(creditAction, undefined);
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(t("creditConfirm"))) e.preventDefault(); }} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="outline" disabled={pending}>{t("credit")}</Button>
      <Message state={state} />
    </form>
  );
}
