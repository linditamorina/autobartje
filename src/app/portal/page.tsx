import Link from "next/link";
import { Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requirePortal } from "@/server/auth/guard";
import { portalOrders } from "@/server/portal";
import { PortalHeader } from "@/components/portal/header";
import { StatusBadge, fmtDate, fmtDateTime } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { formatEur } from "@/lib/money";

export const metadata = { title: "Orders" };

export default async function PortalHome({ searchParams }: PageProps<"/portal">) {
  const { company } = await requirePortal();
  const sp = await searchParams;
  const view = sp.view === "done" ? "done" : "open";
  const [t, ts, tsv, locale, orders] = await Promise.all([getTranslations("Portal"), getTranslations("Admin.status"), getTranslations("Admin.service"), getLocale(), portalOrders(company.id, view)]);

  return (
    <>
      <PortalHeader company={company.name} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold">{t("ordersTitle")}</h1>
          <Button asChild><Link href="/portal/new"><Plus aria-hidden /> {t("nav.new")}</Link></Button>
        </div>
        <div className="flex gap-2" role="group" aria-label={t("ordersTitle")}>
          <Button asChild variant={view === "open" ? "default" : "outline"} size="sm"><Link href="/portal" aria-current={view === "open" ? "page" : undefined}>{t("open")}</Link></Button>
          <Button asChild variant={view === "done" ? "default" : "outline"} size="sm"><Link href="/portal?view=done" aria-current={view === "done" ? "page" : undefined}>{t("done")}</Link></Button>
        </div>
        {orders.length === 0 ? (
          <p className="rounded-xl bg-card p-6 text-muted-foreground">{t(view === "open" ? "noOpen" : "noDone")}</p>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/portal/orders/${o.id}`} className="grid gap-1 rounded-xl border border-border bg-card p-4 hover:border-primary sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{o.number}</span>
                      {o.customerRef && <span className="text-sm text-muted-foreground">{t("ref")}: {o.customerRef}</span>}
                      <StatusBadge status={o.status} label={ts(o.status)} />
                    </p>
                    <p className="text-sm">{tsv(o.service)}{o.vehicle && ` · ${[o.vehicle.make, o.vehicle.model, o.vehicle.plate].filter(Boolean).join(" ")}`}</p>
                    <p className="truncate text-sm text-muted-foreground">{[o.pickupAddress, o.dropoffAddress].filter(Boolean).join(" → ")}</p>
                  </div>
                  <div className="text-sm sm:text-right">
                    <p>{view === "done" ? fmtDate(o.deliveredAt ?? o.createdAt, locale) : o.isAsap ? t("asap") : fmtDateTime(o.requestedAt, locale)}</p>
                    {(o.finalCents ?? o.estimatedCents) != null && <p className="font-semibold tabular-nums">{formatEur((o.finalCents ?? o.estimatedCents)!, locale)}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
