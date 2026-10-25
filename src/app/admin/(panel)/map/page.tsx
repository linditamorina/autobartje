import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/guard";
import { liveFleet } from "@/server/driver/location";
import { PageHeader, Panel, StatusBadge, UrgentBadge } from "@/components/admin/ui";
import { LiveMap, type MapPoint } from "@/components/shared/live-map";
import { LiveRefresh } from "@/components/tracking/live-refresh";
import { mapsLink, telHref } from "@/lib/contact";
import { minutesAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Live map" };

export default async function LiveMapPage() {
  await requireStaff("dispatch.read");
  const [t, ts, tsv, tp, locale, jobs] = await Promise.all([
    getTranslations("Admin.liveMap"),
    getTranslations("Admin.status"),
    getTranslations("Admin.service"),
    getTranslations("Admin.priority"),
    getLocale(),
    liveFleet(),
  ]);

  const points: MapPoint[] = jobs.flatMap((j) => {
    const href = `/admin/orders/${j.order.id}`;
    const out: MapPoint[] = [];
    if (j.position) out.push({ id: `truck-${j.order.id}`, kind: "truck", ...j.position, title: `${j.driver.name} · ${j.order.number}`, href, stale: !j.position.fresh });
    const stop = j.order.status === "IN_TRANSIT" ? j.order.dropoff : j.order.pickup;
    if (stop) out.push({ id: `stop-${j.order.id}`, kind: j.order.status === "IN_TRANSIT" ? "dropoff" : "pickup", ...stop, title: j.order.number, href });
    return out;
  });

  return (
    <>
      <LiveRefresh seconds={15} />
      <PageHeader title={t("title")} />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="space-y-2">
          <LiveMap points={points} language={locale} className="h-[60dvh] min-h-80 w-full overflow-hidden rounded-xl border border-border bg-muted" />
          <p className="text-sm text-muted-foreground">{t("legend")}</p>
        </div>
        <Panel title={`${t("onTheRoad")} (${jobs.length})`}>
          {jobs.length === 0 ? (
            <p className="text-muted-foreground">{t("none")}</p>
          ) : (
            <ul className="space-y-3" data-testid="live-jobs">
              {jobs.map((j) => (
                <li key={j.order.id} className={cn("space-y-1 rounded-lg border-2 p-3", j.order.priority === "URGENT" ? "border-emergency" : "border-border")}>
                  <p className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/orders/${j.order.id}`} className="font-bold underline">{j.order.number}</Link>
                    <StatusBadge status={j.order.status} label={ts(j.order.status)} />
                    {j.order.priority === "URGENT" && <UrgentBadge label={tp("URGENT")} />}
                  </p>
                  <p className="font-semibold">{j.driver.name} · {j.truck.name ?? j.truck.plate}</p>
                  <p className="text-sm text-muted-foreground">{tsv(j.order.service)} · {j.order.status === "IN_TRANSIT" ? j.order.dropoffAddress : j.order.pickupAddress}</p>
                  {j.position ? (
                    <p className={cn("text-sm", !j.position.fresh && "font-semibold text-amber-700 dark:text-amber-400")}>
                      {j.position.fresh ? t("seen", { ago: minutesAgo(j.position.at, locale) }) : t("stale", { ago: minutesAgo(j.position.at, locale) })}
                      {j.position.km != null && ` · ${t("distance", { km: j.position.km.toLocaleString(locale) })}`}
                      {j.position.etaMin != null && j.position.fresh && ` · ${t("eta", { min: j.position.etaMin })}`}
                      {j.position.speedKmh != null && j.position.fresh && ` · ${j.position.speedKmh} km/h`}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{t("noPosition")}</p>
                  )}
                  <p className="flex flex-wrap gap-3 text-sm">
                    {j.position && <a href={mapsLink(j.position.lat, j.position.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline"><MapPin aria-hidden className="size-4" /> {t("openMap")}</a>}
                    {j.driver.phone && <a href={telHref(j.driver.phone)} className="inline-flex items-center gap-1 font-semibold underline"><Phone aria-hidden className="size-4" /> {t("callDriver")}</a>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
