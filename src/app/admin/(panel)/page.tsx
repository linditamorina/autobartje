import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { daysFromNow, startOfBusinessDay } from "@/lib/time";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { formatEur } from "@/lib/money";
import { Panel, PageHeader, StatusBadge, fmtDate, fmtDateTime } from "@/components/admin/ui";

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  await requireStaff();
  const [t, ts, locale, sp] = await Promise.all([getTranslations("Admin.dashboard"), getTranslations("Admin.status"), getLocale(), searchParams]);
  const startOfDay = startOfBusinessDay();
  const in30 = daysFromNow(30);
  const open = { notIn: ["DELIVERED", "COMPLETED", "CANCELLED", "DRAFT"] as ("DELIVERED" | "COMPLETED" | "CANCELLED" | "DRAFT")[] };

  const [newToday, openCount, urgentOpen, deliveredToday, urgent, trucks, drivers] = await Promise.all([
    db.order.count({ where: { createdAt: { gte: startOfDay }, status: { not: "DRAFT" } } }),
    db.order.count({ where: { status: open } }),
    db.order.count({ where: { status: open, priority: "URGENT" } }),
    db.order.count({ where: { deliveredAt: { gte: startOfDay } } }),
    db.order.findMany({ where: { status: open, priority: "URGENT" }, include: { customer: true }, orderBy: { createdAt: "asc" }, take: 10 }),
    db.truck.findMany({
      where: { isActive: true, OR: [{ insuranceExpires: { lte: in30 } }, { registrationExpires: { lte: in30 } }, { inspectionExpires: { lte: in30 } }, { nextServiceAt: { lte: in30 } }] },
    }),
    db.driver.findMany({ where: { isActive: true, OR: [{ licenseExpires: { lte: in30 } }, { cpcExpires: { lte: in30 } }] }, include: { user: true } }),
  ]);

  const expiring = [
    ...trucks.flatMap((tr) =>
      (
        [
          ["insurance", tr.insuranceExpires],
          ["registration", tr.registrationExpires],
          ["inspection", tr.inspectionExpires],
          ["service", tr.nextServiceAt],
        ] as const
      )
        .filter(([, d]) => d && d <= in30)
        .map(([kind, d]) => ({ who: tr.plate, kind, date: d! })),
    ),
    ...drivers.flatMap((d) =>
      (
        [
          ["license", d.licenseExpires],
          ["cpc", d.cpcExpires],
        ] as const
      )
        .filter(([, x]) => x && x <= in30)
        .map(([kind, x]) => ({ who: d.user.name, kind, date: x! })),
    ),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <>
      <PageHeader title={t("title")} />
      {sp.forbidden && <p role="alert" className="mb-4 rounded-lg bg-destructive p-3 font-semibold text-destructive-foreground">{t("forbidden")}</p>}
      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [t("newOrders"), newToday],
          [t("openOrders"), openCount],
          [t("urgentOpen"), urgentOpen],
          [t("delivered"), deliveredToday],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-3xl font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("urgentList")}>
          {urgent.length === 0 ? (
            <p className="text-muted-foreground">{t("noneUrgent")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {urgent.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 py-3 hover:underline">
                    <span>
                      <span className="font-bold">{o.number}</span> · {o.customer.fullName}
                      <span className="block text-sm text-muted-foreground">{o.pickupAddress} · {fmtDateTime(o.createdAt, locale)}</span>
                    </span>
                    <span className="text-right">
                      <StatusBadge status={o.status} label={ts(o.status)} />
                      {o.estimatedCents != null && <span className="block text-sm">{formatEur(o.finalCents ?? o.estimatedCents, locale)}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("expiring")}>
          {expiring.length === 0 ? (
            <p className="text-muted-foreground">{t("noneExpiring")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {expiring.map((e) => (
                <li key={`${e.who}-${e.kind}`} className="flex justify-between gap-3 py-2">
                  <span>
                    <span className="font-semibold">{e.who}</span> · {t(`expiryKinds.${e.kind}`)}
                  </span>
                  <span className={e.date < new Date() ? "font-bold text-destructive" : ""}>{fmtDate(e.date, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
