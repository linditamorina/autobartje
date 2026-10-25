import Link from "next/link";
import { Download } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/guard";
import { driverStats, groupBy, heatmap, monthlyInvoiced, paymentsByMethod, periodFrom, summary, type GroupRow, type PeriodKey } from "@/server/reports/compute";
import { reportInvoices, reportOrders, reportPayments, reportQuotes } from "@/server/reports/queries";
import { businessDate, businessDayRange } from "@/lib/time";
import { formatEur } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PageHeader, Panel } from "@/components/admin/ui";
import { BarChart, Heatmap, Stat } from "@/components/admin/charts";

export const metadata = { title: "Reports" };

const PRESETS: PeriodKey[] = ["month", "lastMonth", "30d", "year"];

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireStaff("reports.read");
  const sp = Object.fromEntries(Object.entries(await searchParams).filter((e): e is [string, string] => typeof e[1] === "string"));
  const period = periodFrom(sp);
  // The revenue chart always shows the last 12 months, whatever the period.
  const [y, m] = businessDate().split("-").map(Number);
  const yearAgo = businessDayRange(new Date(Date.UTC(y, m - 12, 1)).toISOString().slice(0, 10)).start;

  const [t, tsv, tch, tm, locale, orders, invoices, yearInvoices, payments, quotes] = await Promise.all([
    getTranslations("Admin.reports"),
    getTranslations("Admin.service"),
    getTranslations("Admin.channel"),
    getTranslations("Admin.invoices.methods"),
    getLocale(),
    reportOrders(period),
    reportInvoices(period.from, period.to),
    reportInvoices(yearAgo, businessDayRange(businessDate()).end),
    reportPayments(period),
    reportQuotes(period),
  ]);

  const s = summary(orders, invoices, quotes);
  const eur = (c: number) => formatEur(c, locale);
  const pct = (x: number | null) => (x == null ? "–" : new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(x));
  const mins = (x: number | null) => (x == null ? "–" : t("minutes", { n: x }));
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const months = monthlyInvoiced(yearInvoices);
  const grid = heatmap(orders);
  const days = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 5 + i))));
  let busiest = { d: 0, h: 0, n: 0 };
  grid.forEach((row, d) => row.forEach((n, h) => n > busiest.n && (busiest = { d, h, n })));
  const drivers = driverStats(orders);
  const methods = paymentsByMethod(payments);
  const csvQuery = new URLSearchParams(period.key === "custom" ? { period: "custom", from: period.fromDate, to: period.toDate } : { period: period.key }).toString();

  const groupTable = (rows: GroupRow[], label: (k: string) => string, testId: string) =>
    rows.length === 0 ? (
      <p className="text-muted-foreground">{t("noData")}</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid={testId}>
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th scope="col" className="py-2 font-semibold">&nbsp;</th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">{t("cols.orders")}</th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">{t("cols.done")}</th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">{t("cols.value")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border last:border-0">
                <th scope="row" className="py-2 text-left font-semibold">{label(r.key)}</th>
                <td className="py-2 pl-3 text-right tabular-nums">{r.orders}</td>
                <td className="py-2 pl-3 text-right tabular-nums">{r.done}</td>
                <td className="py-2 pl-3 text-right tabular-nums">{eur(r.valueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <>
      <PageHeader title={t("title")}>
        <a href={`/api/admin/reports/orders?${csvQuery}`} className="inline-flex min-h-12 items-center gap-2 rounded-lg border-2 border-border px-3 font-semibold">
          <Download aria-hidden className="size-5" /> {t("exportOrders")}
        </a>
      </PageHeader>

      <nav aria-label={t("period")} className="mb-4 flex flex-wrap items-end gap-2">
        {PRESETS.map((k) => (
          <Link key={k} href={`?period=${k}`} aria-current={period.key === k ? "page" : undefined} className={cn("inline-flex min-h-11 items-center rounded-full border-2 px-4 font-semibold", period.key === k ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
            {t(`periods.${k}`)}
          </Link>
        ))}
        <form className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="period" value="custom" />
          <label className="text-sm">
            <span className="block text-muted-foreground">{t("from")}</span>
            <input type="date" name="from" defaultValue={period.fromDate} className="min-h-11 rounded-lg border-2 border-input bg-background px-2" />
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground">{t("to")}</span>
            <input type="date" name="to" defaultValue={period.toDate} className="min-h-11 rounded-lg border-2 border-input bg-background px-2" />
          </label>
          <button type="submit" className={cn("min-h-11 rounded-lg px-4 font-semibold", period.key === "custom" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>{t("show")}</button>
        </form>
      </nav>

      <div className="space-y-4">
        <section aria-label={t("summary")} className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="kpis">
          <Stat label={t("kpi.orders")} value={String(s.orders)} hint={t("kpi.ordersHint", { done: s.done, b2b: s.b2b })} />
          <Stat label={t("kpi.value")} value={eur(s.doneValueCents)} hint={s.avgOrderCents != null ? t("kpi.avg", { avg: eur(s.avgOrderCents) }) : undefined} />
          <Stat label={t("kpi.invoiced")} value={eur(s.invoicedGrossCents)} hint={t("kpi.net", { net: eur(s.invoicedNetCents) })} />
          <Stat label={t("kpi.cancelled")} value={pct(s.cancelRate)} hint={t("kpi.cancelledHint", { n: s.cancelled })} />
          <Stat label={t("kpi.arrival")} value={mins(s.arrival.median)} hint={s.arrival.count ? t("kpi.arrivalHint", { p90: mins(s.arrival.p90), n: s.arrival.count }) : t("kpi.arrivalNone")} />
          <Stat label={t("kpi.confirm")} value={mins(s.confirmMedian)} hint={t("kpi.confirmHint")} />
          <Stat label={t("kpi.conversion")} value={pct(s.quoteConversion)} hint={t("kpi.conversionHint", { n: s.quotes })} />
          <Stat label={t("kpi.received")} value={eur(methods.reduce((a, r) => a + r.cents, 0))} hint={methods.map((r) => `${tm(r.method as never)} ${eur(r.cents)}`).join(" · ") || undefined} />
        </section>

        <Panel title={t("revenueTitle")}>
          <BarChart
            caption={t("revenueCaption")}
            tableLabel={t("showTable")}
            bars={months.map((r) => ({ label: monthFmt.format(new Date(`${r.month}-15T00:00:00Z`)), value: r.grossCents, display: eur(r.grossCents) }))}
          />
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title={t("byService")}>{groupTable(groupBy(orders, (o) => o.service), (k) => tsv(k as never), "by-service")}</Panel>
          <Panel title={t("byChannel")}>{groupTable(groupBy(orders, (o) => o.channel), (k) => tch(k as never), "by-channel")}</Panel>
          <Panel title={t("bySource")}>
            <p className="mb-2 text-sm text-muted-foreground">{t("bySourceHint")}</p>
            {groupTable(groupBy(orders, (o) => o.leadSource), (k) => k || t("direct"), "by-source")}
          </Panel>
          <Panel title={t("drivers")}>
            {drivers.length === 0 ? (
              <p className="text-muted-foreground">{t("noData")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="drivers">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th scope="col" className="py-2 font-semibold">&nbsp;</th>
                      <th scope="col" className="py-2 pl-3 text-right font-semibold">{t("cols.jobs")}</th>
                      <th scope="col" className="py-2 pl-3 text-right font-semibold">km</th>
                      <th scope="col" className="py-2 pl-3 text-right font-semibold">{t("cols.value")}</th>
                      <th scope="col" className="py-2 pl-3 text-right font-semibold">{t("cols.arrival")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => (
                      <tr key={d.id} className="border-b border-border last:border-0">
                        <th scope="row" className="py-2 text-left font-semibold">{d.name}</th>
                        <td className="py-2 pl-3 text-right tabular-nums">{d.jobs}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{d.km.toLocaleString(locale)}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{eur(d.valueCents)}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{mins(d.arrivalMedian)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <Panel title={t("busyTitle")}>
          <Heatmap
            grid={grid}
            days={days}
            busiest={busiest.n ? t("busiest", { day: days[busiest.d], hour: String(busiest.h).padStart(2, "0"), n: busiest.n }) : t("noData")}
            cellLabel={(day, hour, n) => t("cell", { day, hour: String(hour).padStart(2, "0"), n })}
          />
        </Panel>
        <p className="text-sm text-muted-foreground">{t("footnote")}</p>
      </div>
    </>
  );
}
