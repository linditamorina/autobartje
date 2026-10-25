import { getLocale, getTranslations } from "next-intl/server";
import { requirePortal } from "@/server/auth/guard";
import { portalInvoices } from "@/server/portal";
import { stripeEnabled } from "@/server/payments/stripe";
import { PortalHeader } from "@/components/portal/header";
import { INVOICE_STYLE, fmtDate } from "@/components/admin/ui";
import { formatEur } from "@/lib/money";
import { trackUrl } from "@/lib/tracking";
import { cn } from "@/lib/utils";

export const metadata = { title: "Invoices" };

export default async function PortalInvoicesPage() {
  const { company } = await requirePortal();
  const [t, ti, locale, invoices] = await Promise.all([getTranslations("Portal"), getTranslations("Admin.invoices"), getLocale(), portalInvoices(company.id)]);
  const online = stripeEnabled();
  const open = invoices.filter((i) => i.kind === "INVOICE" && ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(i.status));
  const openCents = open.reduce((s, i) => s + i.totalCents - i.paidCents, 0);

  return (
    <>
      <PortalHeader company={company.name} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <h1 className="text-2xl font-extrabold">{t("invoicesTitle")}</h1>
        {open.length > 0 && <p className="rounded-xl bg-card p-4 font-semibold">{t("openTotal", { amount: formatEur(openCents, locale), count: open.length })}</p>}
        {invoices.length === 0 ? (
          <p className="rounded-xl bg-card p-6 text-muted-foreground">{t("noInvoices")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="p-3">{t("invoice")}</th>
                  <th scope="col" className="p-3">{t("issued")}</th>
                  <th scope="col" className="p-3">{t("due")}</th>
                  <th scope="col" className="p-3 text-right">{t("total")}</th>
                  <th scope="col" className="p-3">{t("status")}</th>
                  <th scope="col" className="p-3"><span className="sr-only">{t("actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => {
                  const payable = online && i.order && i.kind === "INVOICE" && ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(i.status);
                  return (
                    <tr key={i.id} className="border-t border-border">
                      <td className="p-3 font-semibold">
                        {i.number}
                        {i.kind === "CREDIT_NOTE" && <span className="block text-xs text-muted-foreground">{t("creditNote")}</span>}
                        {i.order && <span className="block text-xs font-normal text-muted-foreground">{i.order.number}</span>}
                      </td>
                      <td className="p-3">{fmtDate(i.issueDate, locale)}</td>
                      <td className="p-3">{fmtDate(i.dueDate, locale)}</td>
                      <td className="p-3 text-right tabular-nums">{formatEur(i.totalCents, locale)}</td>
                      <td className="p-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", INVOICE_STYLE[i.status])}>{ti(`statuses.${i.status}`)}</span></td>
                      <td className="space-x-3 whitespace-nowrap p-3">
                        <a href={`/api/portal/invoices/${i.id}/pdf`} target="_blank" rel="noopener" className="font-semibold underline">PDF</a>
                        {payable && <a href={trackUrl(i.order!.trackingToken, i.order!.locale)} className="font-semibold underline">{t("payOnline")}</a>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{t("invoicesNote")}</p>
      </main>
    </>
  );
}
