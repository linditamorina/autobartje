import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import type { Buyer } from "@/server/invoicing/manage";
import { formatEur } from "@/lib/money";
import { businessDate } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { INVOICE_STYLE, PageHeader, Panel, fmtDate } from "@/components/admin/ui";
import { CreditButton, DraftEditor, IssueButton } from "@/components/admin/invoice-forms";
import { FieldsForm } from "@/components/admin/fields-form";
import { cn } from "@/lib/utils";
import { paymentAction } from "../actions";

export const metadata = { title: "Invoice" };

const hundredths = (c: number) => (c / 100).toFixed(2);

export default async function InvoicePage({ params }: PageProps<"/admin/invoices/[id]">) {
  const user = await requireStaff("invoices.read");
  const { id } = await params;
  const inv = await db.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { position: "asc" } }, payments: { orderBy: { createdAt: "asc" } }, order: { select: { id: true, number: true } } },
  });
  if (!inv) notFound();
  const [t, locale, related] = await Promise.all([
    getTranslations("Admin.invoices"),
    getLocale(),
    db.invoice.findMany({ where: { OR: [{ creditedInvoiceId: inv.id }, ...(inv.creditedInvoiceId ? [{ id: inv.creditedInvoiceId }] : [])] }, select: { id: true, number: true, kind: true } }),
  ]);
  const buyer = (inv.buyerSnapshot ?? {}) as Partial<Buyer>;
  const canIssue = can(user.permissions, "invoices.issue");
  const canPay = can(user.permissions, "payments.record") && inv.kind === "INVOICE" && ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status);
  const due = inv.totalCents - inv.paidCents;

  return (
    <>
      <Link href="/admin/invoices" className="mb-2 inline-block text-sm font-semibold underline">← {t("title")}</Link>
      <PageHeader title={inv.number ? `${inv.kind === "CREDIT_NOTE" ? t("creditNote") : t("invoice")} ${inv.number}` : t("draftTitle")}>
        <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-sm font-bold", INVOICE_STYLE[inv.status])}>{t(`statuses.${inv.status}`)}</span>
        {inv.number && (
          <Button asChild variant="outline">
            <a href={`/api/admin/invoices/${inv.id}/pdf`} target="_blank" rel="noopener"><FileDown aria-hidden /> PDF</a>
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {inv.status === "DRAFT" && canIssue ? (
            <Panel>
              <DraftEditor
                draft={{
                  id: inv.id,
                  buyer: { name: buyer.name ?? "", nui: buyer.nui ?? "", address: buyer.address ?? "", city: buyer.city ?? "", email: buyer.email ?? "", phone: buyer.phone ?? "" },
                  pricesIncludeVat: inv.pricesIncludeVat,
                  lines: inv.lines.map((l) => ({ description: l.description, quantity: String(Number(l.quantity)), unit: l.unit, unitPrice: hundredths(l.unitPriceCents), vatRate: String(l.vatRateBp / 100) })),
                }}
              />
            </Panel>
          ) : (
            <Panel>
              <p className="font-bold">{buyer.name}</p>
              <p className="text-sm text-muted-foreground">{[buyer.address, buyer.city, buyer.nui && `NUI ${buyer.nui}`, buyer.email, buyer.phone].filter(Boolean).join(" · ")}</p>
              <table className="mt-4 w-full text-sm">
                <thead><tr className="border-b border-border text-left"><th className="py-2">{t("description")}</th><th className="py-2 text-right">{t("quantity")}</th><th className="py-2 text-right">{t("unitPrice")}</th><th className="py-2 text-right">{t("net")}</th></tr></thead>
                <tbody>
                  {inv.lines.map((l) => (
                    <tr key={l.id} className="border-b border-border">
                      <td className="py-2 pr-2">{l.description}</td>
                      <td className="py-2 text-right tabular-nums">{Number(l.quantity)} {l.unit}</td>
                      <td className="py-2 text-right tabular-nums">{formatEur(l.unitPriceCents, locale)}</td>
                      <td className="py-2 text-right tabular-nums">{formatEur(l.netCents, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="ml-auto mt-3 grid max-w-xs grid-cols-2 gap-1 text-right tabular-nums">
                <dt>{t("net")}</dt><dd>{formatEur(inv.subtotalCents, locale)}</dd>
                <dt>{t("vat")}</dt><dd>{formatEur(inv.vatCents, locale)}</dd>
                <dt className="font-bold">{t("total")}</dt><dd className="font-bold" data-testid="invoice-total">{formatEur(inv.totalCents, locale)}</dd>
              </dl>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel title={t("details")}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {inv.order && <><dt className="text-muted-foreground">{t("order")}</dt><dd><Link href={`/admin/orders/${inv.order.id}`} className="underline">{inv.order.number}</Link></dd></>}
              {inv.issueDate && <><dt className="text-muted-foreground">{t("issued")}</dt><dd>{fmtDate(inv.issueDate, locale)}</dd></>}
              {inv.dueDate && <><dt className="text-muted-foreground">{t("due")}</dt><dd>{fmtDate(inv.dueDate, locale)}</dd></>}
              {related.map((r) => (
                <span key={r.id} className="contents"><dt className="text-muted-foreground">{r.kind === "CREDIT_NOTE" ? t("creditNote") : t("invoice")}</dt><dd><Link href={`/admin/invoices/${r.id}`} className="underline">{r.number}</Link></dd></span>
              ))}
            </dl>
            {inv.status === "DRAFT" && canIssue && <div className="mt-4"><IssueButton id={inv.id} /></div>}
            {inv.kind === "INVOICE" && inv.status !== "DRAFT" && inv.status !== "VOID" && canIssue && <div className="mt-4"><CreditButton id={inv.id} /></div>}
          </Panel>

          {inv.kind === "INVOICE" && inv.status !== "DRAFT" && (
            <Panel title={t("payments")}>
              <p className="mb-2 text-sm">{t("paidOf", { paid: formatEur(inv.paidCents, locale), total: formatEur(inv.totalCents, locale) })}</p>
              <ul className="mb-3 space-y-1 text-sm">
                {inv.payments.map((p) => (
                  <li key={p.id}>{fmtDate(p.receivedAt ?? p.createdAt, locale)} · {t(`methods.${p.method}`)} · <span className="tabular-nums">{formatEur(p.amountCents, locale)}</span>{p.bankReference && ` · ${p.bankReference}`}</li>
                ))}
              </ul>
              {canPay && (
                <FieldsForm
                  action={paymentAction}
                  hidden={{ id: inv.id }}
                  submitLabel={t("recordPayment")}
                  errors={{ overpaid: t("errors.overpaid"), not_issued: t("errors.not_issued") }}
                  fields={[
                    { name: "amount", label: t("amount"), required: true, defaultValue: hundredths(due) },
                    { name: "method", label: t("method"), type: "select", defaultValue: "CASH", options: (["CASH", "CARD", "BANK_TRANSFER"] as const).map((m) => ({ value: m, label: t(`methods.${m}`) })) },
                    { name: "receivedAt", label: t("receivedAt"), type: "date", required: true, defaultValue: businessDate() },
                    { name: "reference", label: t("reference") },
                  ]}
                />
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
