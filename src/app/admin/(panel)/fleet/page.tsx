import Link from "next/link";
import { Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { daysFromNow } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, fmtDate } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Fleet" };

function Expiry({ label, date, locale, soon, now, t }: { label: string; date: Date | null; locale: string; soon: Date; now: Date; t: (k: "expired" | "expiresSoon") => string }) {
  if (!date) return null;
  const state = date < now ? "expired" : date < soon ? "soon" : "ok";
  return (
    <li className={cn("text-sm", state === "expired" && "font-bold text-destructive", state === "soon" && "font-semibold text-amber-800 dark:text-amber-300")}>
      {label}: {fmtDate(date, locale)}
      {state === "expired" && ` · ${t("expired")}`}
      {state === "soon" && ` · ${t("expiresSoon")}`}
    </li>
  );
}

export default async function FleetPage() {
  const user = await requireStaff("fleet.read");
  const canManage = can(user.permissions, "fleet.manage");
  const [t, locale, trucks, drivers] = await Promise.all([
    getTranslations("Admin.fleet"),
    getLocale(),
    db.truck.findMany({ orderBy: [{ isActive: "desc" }, { plate: "asc" }] }),
    db.driver.findMany({ include: { user: { select: { name: true, phone: true, email: true } } }, orderBy: [{ isActive: "desc" }, { user: { name: "asc" } }] }),
  ]);
  const now = new Date();
  const soon = daysFromNow(30, now);
  const tx = (k: "expired" | "expiresSoon") => t(k);

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{t("trucks")}</h2>
            {canManage && <Button asChild size="sm"><Link href="/admin/fleet/trucks/new"><Plus aria-hidden /> {t("newTruck")}</Link></Button>}
          </div>
          {trucks.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
          <ul className="divide-y divide-border">
            {trucks.map((tr) => (
              <li key={tr.id} className={cn("py-3", !tr.isActive && "opacity-60")}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <Link href={`/admin/fleet/trucks/${tr.id}`} className="font-bold underline">{tr.plate}</Link>
                  <span className="text-sm text-muted-foreground">
                    {[tr.name, t(`kinds.${tr.kind}` as never), tr.capacityVehicles > 1 ? `${tr.capacityVehicles}×` : null, tr.hasWinch ? t("winch") : null].filter(Boolean).join(" · ")}
                  </span>
                  {!tr.isActive && <span className="text-sm font-semibold">{t("inactive")}</span>}
                </div>
                <ul className="mt-1">
                  <Expiry label={t("insurance")} date={tr.insuranceExpires} locale={locale} soon={soon} now={now} t={tx} />
                  <Expiry label={t("registration")} date={tr.registrationExpires} locale={locale} soon={soon} now={now} t={tx} />
                  <Expiry label={t("inspection")} date={tr.inspectionExpires} locale={locale} soon={soon} now={now} t={tx} />
                  <Expiry label={t("nextService")} date={tr.nextServiceAt} locale={locale} soon={soon} now={now} t={tx} />
                </ul>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{t("drivers")}</h2>
            {canManage && <Button asChild size="sm"><Link href="/admin/fleet/drivers/new"><Plus aria-hidden /> {t("newDriver")}</Link></Button>}
          </div>
          {drivers.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
          <ul className="divide-y divide-border">
            {drivers.map((d) => (
              <li key={d.id} className={cn("py-3", !d.isActive && "opacity-60")}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <Link href={`/admin/fleet/drivers/${d.id}`} className="font-bold underline">{d.user.name}</Link>
                  <span className="text-sm text-muted-foreground">{[d.licenseCategory, d.user.phone].filter(Boolean).join(" · ")}</span>
                  {!d.isActive && <span className="text-sm font-semibold">{t("inactive")}</span>}
                </div>
                <ul className="mt-1">
                  <Expiry label={t("licenseExpires")} date={d.licenseExpires} locale={locale} soon={soon} now={now} t={tx} />
                  <Expiry label={t("cpcExpires")} date={d.cpcExpires} locale={locale} soon={soon} now={now} t={tx} />
                </ul>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
