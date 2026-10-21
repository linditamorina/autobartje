import Link from "next/link";
import { Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listOrders, type OrderListItem } from "@/server/orders/queries";
import { BOARD_STATUSES, ORDER_STATUSES } from "@/server/orders/status";
import { formatEur } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge, UrgentBadge, fmtDateTime } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Orders" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const user = await requireStaff("orders.read");
  const sp = await searchParams;
  const view = str(sp.view) === "board" ? "board" : "table";
  const filters = { q: str(sp.q), status: str(sp.status) ?? (view === "board" ? "open" : undefined), service: str(sp.service), page: Number(str(sp.page)) || 1 };
  const [t, ts, tsv, tp, locale, data] = await Promise.all([
    getTranslations("Admin.orders"),
    getTranslations("Admin.status"),
    getTranslations("Admin.service"),
    getTranslations("Admin.priority"),
    getLocale(),
    listOrders(view === "board" ? { ...filters, page: 1 } : filters),
  ]);

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: filters.q, status: str(sp.status), service: filters.service, view, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `?${p.toString()}`;
  };
  const price = (o: OrderListItem) =>
    o.finalCents != null ? formatEur(o.finalCents, locale) : o.estimatedCents != null ? `${formatEur(o.estimatedCents, locale)} ${t("estimate")}` : "–";

  return (
    <>
      <PageHeader title={t("title")}>
        <div className="inline-flex rounded-lg border-2 border-border p-0.5" role="group">
          <Link href={qs({ view: "table", page: undefined })} aria-current={view === "table" ? "page" : undefined} className={cn("rounded-md px-3 py-2 text-sm font-semibold", view === "table" && "bg-primary text-primary-foreground")}>
            {t("table")}
          </Link>
          <Link href={qs({ view: "board", page: undefined })} aria-current={view === "board" ? "page" : undefined} className={cn("rounded-md px-3 py-2 text-sm font-semibold", view === "board" && "bg-primary text-primary-foreground")}>
            {t("board")}
          </Link>
        </div>
        {can(user.permissions, "orders.create") && (
          <Button asChild>
            <Link href="/admin/orders/new">
              <Plus aria-hidden /> {t("new")}
            </Link>
          </Button>
        )}
      </PageHeader>

      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]" role="search">
        <input type="hidden" name="view" value={view} />
        <label className="sr-only" htmlFor="q">{t("search")}</label>
        <input id="q" name="q" defaultValue={filters.q} placeholder={t("search")} className="min-h-12 rounded-lg border-2 border-input bg-background px-3" />
        <select name="status" defaultValue={str(sp.status) ?? ""} aria-label={t("status")} className="min-h-12 rounded-lg border-2 border-input bg-background px-2">
          <option value="">{t("allStatuses")}</option>
          <option value="open">{t("openOnly")}</option>
          {ORDER_STATUSES.filter((s) => s !== "DRAFT").map((s) => (
            <option key={s} value={s}>{ts(s)}</option>
          ))}
        </select>
        <select name="service" defaultValue={filters.service ?? ""} aria-label={t("route")} className="min-h-12 rounded-lg border-2 border-input bg-background px-2">
          <option value="">{t("allServices")}</option>
          {(["EMERGENCY_TOWING", "ROADSIDE_ASSISTANCE", "DOMESTIC_TRANSPORT", "INTERNATIONAL_TRANSPORT"] as const).map((s) => (
            <option key={s} value={s}>{tsv(s)}</option>
          ))}
        </select>
        <Button type="submit" variant="secondary">{t("filter")}</Button>
      </form>

      {data.orders.length === 0 && <p className="rounded-xl bg-card p-6 text-center text-muted-foreground">{t("empty")}</p>}

      {view === "table" && data.orders.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="p-3">{t("number")}</th>
                <th scope="col" className="p-3">{t("customer")}</th>
                <th scope="col" className="p-3">{t("route")}</th>
                <th scope="col" className="p-3">{t("when")}</th>
                <th scope="col" className="p-3 text-right">{t("price")}</th>
                <th scope="col" className="p-3">{t("status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.orders.map((o) => (
                <tr key={o.id} className={cn("hover:bg-muted/60", o.priority === "URGENT" && o.status === "RECEIVED" && "bg-emergency/5")}>
                  <td className="p-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-bold underline-offset-4 hover:underline">{o.number}</Link>
                    <span className="block text-xs text-muted-foreground">{tsv(o.service)}</span>
                    {o.priority === "URGENT" && <UrgentBadge label={tp("URGENT")} />}
                  </td>
                  <td className="p-3">
                    {o.customer.fullName}
                    <span className="block text-xs text-muted-foreground">{o.customer.phone}</span>
                  </td>
                  <td className="max-w-xs p-3">
                    <span className="line-clamp-1">{o.pickupAddress}</span>
                    {o.dropoffAddress && <span className="line-clamp-1 text-muted-foreground">→ {o.dropoffAddress}</span>}
                  </td>
                  <td className="whitespace-nowrap p-3">{o.isAsap ? t("asap") : fmtDateTime(o.requestedAt ?? o.windowStart, locale)}</td>
                  <td className="whitespace-nowrap p-3 text-right tabular-nums">{price(o)}</td>
                  <td className="p-3"><StatusBadge status={o.status} label={ts(o.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "table" && data.pages > 1 && (
        <nav className="mt-4 flex items-center justify-between" aria-label="Pagination">
          {data.page > 1 ? <Link className="font-semibold underline" href={qs({ page: String(data.page - 1) })}>← {data.page - 1}</Link> : <span />}
          <span className="text-sm text-muted-foreground">{data.page} / {data.pages}</span>
          {data.page < data.pages ? <Link className="font-semibold underline" href={qs({ page: String(data.page + 1) })}>{data.page + 1} →</Link> : <span />}
        </nav>
      )}

      {view === "board" && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {BOARD_STATUSES.map((s) => {
            const col = data.orders.filter((o) => o.status === s);
            return (
              <section key={s} className="w-72 shrink-0 rounded-xl bg-background p-2" aria-label={ts(s)}>
                <h2 className="mb-2 flex items-center justify-between px-1 font-bold">
                  {ts(s)} <span className="rounded-full bg-muted px-2 text-sm">{col.length}</span>
                </h2>
                <ul className="space-y-2">
                  {col.map((o) => (
                    <li key={o.id}>
                      <Link href={`/admin/orders/${o.id}`} className={cn("block rounded-lg border bg-card p-3 text-sm hover:border-primary", o.priority === "URGENT" ? "border-emergency" : "border-border")}>
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-bold">{o.number}</span>
                          {o.priority === "URGENT" && <UrgentBadge label={tp("URGENT")} />}
                        </span>
                        <span className="block">{o.customer.fullName}</span>
                        <span className="line-clamp-2 text-muted-foreground">{o.pickupAddress}{o.dropoffAddress && ` → ${o.dropoffAddress}`}</span>
                        <span className="mt-1 flex justify-between">
                          <span>{o.isAsap ? t("asap") : fmtDateTime(o.requestedAt ?? o.windowStart, locale)}</span>
                          <span className="tabular-nums">{price(o)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
