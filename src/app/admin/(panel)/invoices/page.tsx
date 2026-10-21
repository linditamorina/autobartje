import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import type { Buyer } from "@/server/invoicing/manage";
import { businessDate } from "@/lib/time";
import { formatEur } from "@/lib/money";
import { INVOICE_STYLE, PageHeader, Panel, fmtDate } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Invoices" };

const STATUSES = ["DRAFT", "ISSUED", "PARTIALLY_PAID", "OVERDUE", "PAID", "VOID"] as const;

export default async function InvoicesPage({ searchParams }: PageProps<"/admin/invoices">) {
  await requireStaff("invoices.read");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const where: Prisma.InvoiceWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { order: { number: { contains: q, mode: "insensitive" } } }, { customer: { fullName: { contains: q, mode: "insensitive" } } }, { company: { name: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const today = businessDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [t, locale, rows, open] = await Promise.all([
    getTranslations("Admin.invoices"),
    getLocale(),
    db.invoice.findMany({ where, orderBy: [{ createdAt: "desc" }], take: 100, include: { order: { select: { number: true } } } }),
    db.invoice.aggregate({ where: { kind: "INVOICE", status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } }, _sum: { totalCents: true, paidCents: true }, _count: true }),
  ]);
  const outstanding = (open._sum.totalCents ?? 0) - (open._sum.paidCents ?? 0);

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Panel>
          <p className="text-sm text-muted-foreground">{t("outstanding", { count: open._count })}</p>
          <p className="text-3xl font-extrabold tabular-nums">{formatEur(outstanding, locale)}</p>
        </Panel>
        <Panel title={t("export")}>
          <form action="/api/admin/invoices/export" method="get" className="flex flex-wrap items-end gap-2">
            <label className="space-y-1"><span className="block text-sm font-semibold">{t("from")}</span><input type="date" name="from" defaultValue={monthStart} required className="min-h-12 rounded-lg border-2 border-input bg-background px-2" /></label>
            <label className="space-y-1"><span className="block text-sm font-semibold">{t("to")}</span><input type="date" name="to" defaultValue={today} required className="min-h-12 rounded-lg border-2 border-input bg-background px-2" /></label>
            <button type="submit" name="format" value="xlsx" className="min-h-12 rounded-lg bg-primary px-4 font-semibold text-primary-foreground">Excel</button>
            <button type="submit" name="format" value="csv" className="min-h-12 rounded-lg border-2 border-border px-4 font-semibold">CSV</button>
          </form>
        </Panel>
      </div>

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <label className="sr-only" htmlFor="q">{t("search")}</label>
        <input id="q" name="q" defaultValue={q} placeholder={t("search")} className="min-h-12 min-w-0 flex-1 rounded-lg border-2 border-input bg-background px-3" />
        <label className="sr-only" htmlFor="status">{t("status")}</label>
        <select id="status" name="status" defaultValue={status ?? ""} className="min-h-12 rounded-lg border-2 border-input bg-background px-3">
          <option value="">{t("allStatuses")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`statuses.${s}`)}</option>)}
        </select>
        <button type="submit" className="min-h-12 rounded-lg bg-secondary px-4 font-semibold text-secondary-foreground">{t("filter")}</button>
      </form>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-1 p-3 sm:grid-cols-[10rem_1fr_auto] sm:items-center">
              <Link href={`/admin/invoices/${r.id}`} className="font-bold underline">{r.number ?? t("draft")}</Link>
              <div className="min-w-0 text-sm">
                <span className={cn("mr-2 inline-flex rounded-full px-2 py-0.5 text-xs font-bold", INVOICE_STYLE[r.status])}>{t(`statuses.${r.status}`)}</span>
                {r.kind === "CREDIT_NOTE" && <span className="mr-2 font-semibold">{t("creditNote")}</span>}
                {(r.buyerSnapshot as Buyer)?.name}
                {r.order && <span className="text-muted-foreground"> · {r.order.number}</span>}
                {r.issueDate && <span className="text-muted-foreground"> · {fmtDate(r.issueDate, locale)}</span>}
              </div>
              <span className="font-semibold tabular-nums sm:text-right">{formatEur(r.totalCents, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
