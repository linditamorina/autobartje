import Link from "next/link";
import { ChevronRight, MapPin, Siren } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireDriver } from "@/server/auth/guard";
import { driverForUser, driverJobs } from "@/server/driver/jobs";
import { DriverHeader } from "@/components/driver/header";
import { StatusBadge, fmtDateTime } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Jobs" };

export default async function DriverHome() {
  const user = await requireDriver();
  const [t, ts, locale] = await Promise.all([getTranslations("Driver"), getTranslations("Admin.status"), getLocale()]);
  const driver = await driverForUser(user.id).catch(() => null);
  if (!driver) {
    return (
      <>
        <DriverHeader name={user.name} />
        <main className="mx-auto max-w-2xl p-4"><p className="rounded-xl bg-card p-4">{t("noProfile")}</p></main>
      </>
    );
  }
  const { todo, done } = await driverJobs(driver.id);

  return (
    <>
      <DriverHeader name={driver.user.name} />
      <main className="mx-auto max-w-2xl space-y-6 p-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <section aria-labelledby="todo">
          <h2 id="todo" className="mb-2 px-1 text-xl font-extrabold">{t("todo")} ({todo.length})</h2>
          {todo.length === 0 ? (
            <p className="rounded-xl bg-card p-4 text-muted-foreground">{t("noJobs")}</p>
          ) : (
            <ul className="space-y-3">
              {todo.map((a) => (
                <li key={a.id}>
                  <Link href={`/driver/jobs/${a.order.id}`} className={cn("flex items-center gap-3 rounded-xl border-2 bg-card p-4 active:bg-muted", a.order.priority === "URGENT" ? "border-emergency" : "border-transparent")}>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex flex-wrap items-center gap-2">
                        {a.order.priority === "URGENT" && <Siren aria-label={t("urgent")} className="size-5 text-emergency" />}
                        <span className="font-bold">{a.order.number}</span>
                        <StatusBadge status={a.order.status} label={ts(a.order.status)} />
                      </p>
                      <p className="text-base">{a.order.customer.fullName}{a.order.vehicle && ` · ${[a.order.vehicle.make, a.order.vehicle.model].filter(Boolean).join(" ")}`}</p>
                      <p className="flex items-start gap-1 text-base text-muted-foreground"><MapPin aria-hidden className="mt-1 size-4 shrink-0" /> {a.order.pickupAddress}</p>
                      <p className="text-sm text-muted-foreground">{a.order.isAsap ? t("asap") : fmtDateTime(a.plannedStart, locale)} · {a.truck.name ?? a.truck.plate}</p>
                    </div>
                    <ChevronRight aria-hidden className="size-6 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        {done.length > 0 && (
          <section aria-labelledby="done">
            <h2 id="done" className="mb-2 px-1 text-xl font-extrabold">{t("doneToday")} ({done.length})</h2>
            <ul className="divide-y divide-border rounded-xl bg-card">
              {done.map((a) => (
                <li key={a.id}>
                  <Link href={`/driver/jobs/${a.order.id}`} className="flex min-h-14 items-center justify-between gap-2 px-4 py-2">
                    <span><span className="font-bold">{a.order.number}</span> · {a.order.customer.fullName}</span>
                    <StatusBadge status={a.order.status} label={ts(a.order.status)} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
