import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { assignChoices, dispatchDay } from "@/server/dispatch/queries";
import { defaultDurationMin } from "@/server/dispatch/conflicts";
import { BUSINESS_TZ, businessDate, businessDayRange, roundedNow, toBusinessLocal } from "@/lib/time";
import { PageHeader, Panel, StatusBadge, UrgentBadge, fmtDateTime } from "@/components/admin/ui";
import { AssignForm } from "@/components/admin/assign-form";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dispatch" };

const shiftDay = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const fmtTime = (d: Date, locale: string) => new Intl.DateTimeFormat(locale, { timeZone: BUSINESS_TZ, hour: "2-digit", minute: "2-digit" }).format(d);

export default async function DispatchPage({ searchParams }: PageProps<"/admin/dispatch">) {
  const user = await requireStaff("dispatch.read");
  const sp = await searchParams;
  const today = businessDate();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const range = businessDayRange(date);
  const canAssign = can(user.permissions, "orders.assign");
  const [t, ts, tsv, tp, to, locale, day, choices] = await Promise.all([
    getTranslations("Admin.dispatch"),
    getTranslations("Admin.status"),
    getTranslations("Admin.service"),
    getTranslations("Admin.priority"),
    getTranslations("Admin.orders"),
    getLocale(),
    dispatchDay(range),
    canAssign ? assignChoices() : Promise.resolve({ drivers: [], trucks: [] }),
  ]);
  const dayMs = range.end.getTime() - range.start.getTime();
  const pct = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - range.start.getTime()) / dayMs) * 100));
  const nowLocal = toBusinessLocal(roundedNow());

  return (
    <>
      <PageHeader title={t("title")}>
        <nav className="flex items-center gap-1" aria-label={t("day")}>
          <Link href={`?date=${shiftDay(date, -1)}`} className="inline-flex size-12 items-center justify-center rounded-lg border-2 border-border" aria-label={t("prevDay")}><ChevronLeft aria-hidden /></Link>
          <form className="flex gap-1">
            <label className="sr-only" htmlFor="date">{t("day")}</label>
            <input id="date" type="date" name="date" defaultValue={date} className="min-h-12 rounded-lg border-2 border-input bg-background px-2" />
            <button type="submit" className="min-h-12 rounded-lg bg-secondary px-3 font-semibold text-secondary-foreground">OK</button>
          </form>
          <Link href={`?date=${shiftDay(date, 1)}`} className="inline-flex size-12 items-center justify-center rounded-lg border-2 border-border" aria-label={t("nextDay")}><ChevronRight aria-hidden /></Link>
          {date !== today && <Link href="?" className="ml-1 font-semibold underline">{t("today")}</Link>}
        </nav>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Panel title={`${t("toAssign")} (${day.unassigned.length})`}>
          {day.unassigned.length === 0 ? (
            <p className="text-muted-foreground">{t("noneToAssign")}</p>
          ) : (
            <ul className="space-y-3">
              {day.unassigned.map((o) => (
                <li key={o.id} className={cn("rounded-lg border-2 p-3", o.priority === "URGENT" ? "border-emergency" : "border-border")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/orders/${o.id}`} className="font-bold underline">{o.number}</Link>
                    <StatusBadge status={o.status} label={ts(o.status)} />
                    {o.priority === "URGENT" && <UrgentBadge label={tp("URGENT")} />}
                    <span className="text-sm text-muted-foreground">{tsv(o.service)}</span>
                  </div>
                  <p className="mt-1 text-sm">{o.customer.fullName} · {o.pickupAddress}{o.dropoffAddress && ` → ${o.dropoffAddress}`}</p>
                  <p className="text-sm text-muted-foreground">{o.isAsap ? to("asap") : fmtDateTime(o.requestedAt, locale)}</p>
                  {canAssign && (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-semibold text-primary">{t("assign")}</summary>
                      <div className="mt-2">
                        <AssignForm
                          compact
                          orderId={o.id}
                          drivers={choices.drivers}
                          trucks={choices.trucks}
                          defaultStart={o.requestedAt && !o.isAsap ? toBusinessLocal(o.requestedAt) : nowLocal}
                          defaultDurationMin={defaultDurationMin(o.service, o.durationMin)}
                        />
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title={t("onCall")}>
            {day.onCall.length === 0 ? (
              <p className="text-muted-foreground">{t("noShifts")}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {day.onCall.map((s) => (
                  <li key={s.id} className="rounded-full bg-muted px-3 py-1 text-sm">
                    <span className="font-semibold">{s.driver.user.name}</span> {fmtTime(s.startsAt, locale)}–{fmtTime(s.endsAt, locale)}
                    {s.isOnCall && " · 24/7"}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <div className="mb-2 hidden grid-cols-[9rem_1fr] text-xs text-muted-foreground md:grid" aria-hidden>
              <span />
              <div className="relative h-4">
                {[0, 6, 12, 18].map((h) => <span key={h} className="absolute" style={{ left: `${(h / 24) * 100}%` }}>{String(h).padStart(2, "0")}:00</span>)}
              </div>
            </div>
            <ul className="space-y-3">
              {day.trucks.map((truck) => (
                <li key={truck.id} className="grid gap-2 md:grid-cols-[9rem_1fr] md:items-center">
                  <div>
                    <p className="font-bold">{truck.plate}</p>
                    <p className="text-xs text-muted-foreground">{[truck.name, truck.kind].filter(Boolean).join(" · ")}</p>
                  </div>
                  {/* Timeline from md up; a list on phones */}
                  <div className="relative hidden h-12 rounded-lg bg-muted md:block">
                    {truck.assignments.map((a) => (
                      <Link
                        key={a.id}
                        href={`/admin/orders/${a.order.id}`}
                        title={`${a.order.number} · ${a.driver.user.name} · ${fmtTime(a.plannedStart, locale)}–${fmtTime(a.plannedEnd, locale)}`}
                        className={cn(
                          "absolute inset-y-1 overflow-hidden rounded-md px-1.5 text-xs font-semibold leading-5 text-primary-foreground",
                          a.order.priority === "URGENT" ? "bg-emergency" : "bg-primary",
                        )}
                        style={{ left: `${pct(a.plannedStart)}%`, width: `max(${pct(a.plannedEnd) - pct(a.plannedStart)}%, 2.5rem)` }}
                      >
                        {a.order.number.slice(-5)}
                        <span className="block truncate font-normal">{a.driver.user.name}</span>
                      </Link>
                    ))}
                    {truck.assignments.length === 0 && <span className="absolute inset-0 flex items-center px-3 text-sm text-muted-foreground">{t("noJobs")}</span>}
                  </div>
                  <ul className="space-y-1 md:hidden">
                    {truck.assignments.length === 0 && <li className="text-sm text-muted-foreground">{t("noJobs")}</li>}
                    {truck.assignments.map((a) => (
                      <li key={a.id} className="text-sm">
                        <Link href={`/admin/orders/${a.order.id}`} className="font-semibold underline">{a.order.number}</Link>{" "}
                        {fmtTime(a.plannedStart, locale)}–{fmtTime(a.plannedEnd, locale)} · {a.driver.user.name}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
