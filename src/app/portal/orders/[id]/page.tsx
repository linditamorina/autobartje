import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requirePortal } from "@/server/auth/guard";
import { portalOrder, PortalError } from "@/server/portal";
import { PortalHeader } from "@/components/portal/header";
import { Panel, StatusBadge, fmtDateTime } from "@/components/admin/ui";
import { formatEur } from "@/lib/money";
import { trackUrl, trackingSteps } from "@/lib/tracking";
import { cn } from "@/lib/utils";

export const metadata = { title: "Order" };

export default async function PortalOrderPage({ params, searchParams }: PageProps<"/portal/orders/[id]">) {
  const { company } = await requirePortal();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const o = await portalOrder(company.id, id).catch((err) => {
    if (err instanceof PortalError) return null;
    throw err;
  });
  if (!o) notFound();
  const [t, tt, ts, tsv, tdr, ti, locale] = await Promise.all([
    getTranslations("Portal"), getTranslations("Track"), getTranslations("Admin.status"), getTranslations("Admin.service"), getTranslations("Driver"), getTranslations("Admin.invoices"), getLocale(),
  ]);
  const steps = trackingSteps(o.status, o.service);
  const reached = new Map(o.statusEvents.map((e) => [e.to as string, e.createdAt]));
  const a = o.assignments[0];
  const price = o.finalCents ?? o.estimatedCents;
  const link = trackUrl(o.trackingToken, o.locale);

  return (
    <>
      <PortalHeader company={company.name} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <Link href="/portal" className="text-sm font-semibold underline">← {t("ordersTitle")}</Link>
        {sp.created === "1" && <p role="status" className="rounded-xl border-2 border-success bg-card p-4 font-semibold">{t("created", { number: o.number })}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold">{tt("title", { number: o.number })}</h1>
          <StatusBadge status={o.status} label={ts(o.status)} />
          {o.customerRef && <span className="text-muted-foreground">{t("ref")}: {o.customerRef}</span>}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Panel title={tt("progress")}>
              {o.status === "CANCELLED" ? (
                <p className="font-semibold">{tt("cancelled")}</p>
              ) : (
                <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {steps.map((s) => (
                    <li key={s.key} aria-current={s.state === "current" ? "step" : undefined} className={cn("rounded-lg border-2 p-2 text-sm", s.state === "done" ? "border-success" : s.state === "current" ? "border-primary dark:border-foreground" : "border-border text-muted-foreground")}>
                      <p className="flex items-center gap-1 font-semibold">{s.state === "done" && <Check aria-hidden className="size-4 text-success" />}{tt(`steps.${o.service === "ROADSIDE_ASSISTANCE" && s.key === "PICKED_UP" ? "ARRIVED" : s.key}`)}</p>
                      {s.state !== "todo" && reached.get(s.key) && <p className="text-xs text-muted-foreground">{fmtDateTime(reached.get(s.key), locale)}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel title={t("details")}>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div><dt className="text-sm text-muted-foreground">{t("service")}</dt><dd className="font-semibold">{tsv(o.service)}</dd></div>
                <div><dt className="text-sm text-muted-foreground">{tt("when")}</dt><dd className="font-semibold">{o.isAsap ? tt("asap") : fmtDateTime(a?.plannedStart ?? o.requestedAt, locale)}</dd></div>
                <div className="sm:col-span-2"><dt className="text-sm text-muted-foreground">{tt("route")}</dt><dd className="font-semibold">{o.pickupAddress}{o.dropoffAddress && ` → ${o.dropoffAddress}`}</dd></div>
                {o.vehicle && <div><dt className="text-sm text-muted-foreground">{t("vehicle")}</dt><dd className="font-semibold">{[o.vehicle.make, o.vehicle.model, o.vehicle.plate, o.vehicle.vin].filter(Boolean).join(" · ")}</dd></div>}
                <div><dt className="text-sm text-muted-foreground">{t("contact")}</dt><dd className="font-semibold">{o.customer.fullName} · {o.customer.phone}</dd></div>
                {a && <div><dt className="text-sm text-muted-foreground">{tt("driver")}</dt><dd className="font-semibold">{a.driver.user.name.split(/\s+/)[0]} · {a.truck.plate}</dd></div>}
              </dl>
            </Panel>

            {o.inspections.length > 0 && (
              <Panel title={tdr("inspections")}>
                <div className="space-y-4">
                  {o.inspections.map((i) => (
                    <section key={i.id} aria-label={tdr(i.kind === "PICKUP" ? "pickupInspection" : "deliveryInspection")}>
                      <h3 className="font-bold">{tdr(i.kind === "PICKUP" ? "pickupInspection" : "deliveryInspection")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {fmtDateTime(i.signedAt ?? i.createdAt, locale)}
                        {i.odometerKm != null && ` · ${i.odometerKm.toLocaleString(locale)} km`}
                        {i.signerName && ` · ${t("signedBy", { name: i.signerName })}`}
                      </p>
                      {i.notes && <p className="text-sm">{i.notes}</p>}
                      <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {i.photos.map((p) => (
                          <li key={p.id}>
                            <a href={`/api/files/inspection/${p.id}`} target="_blank" rel="noopener">
                              {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked image route */}
                              <img src={`/api/files/inspection/${p.id}`} alt={tdr(`angles.${p.angle}` as never)} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </Panel>
            )}
          </div>

          <div className="space-y-4">
            <Panel title={price != null && o.finalCents != null ? tt("price") : tt("estimate")}>
              <p className="text-2xl font-extrabold tabular-nums">{price != null ? formatEur(price, locale) : "–"}</p>
              {price == null && <p className="text-sm text-muted-foreground">{t("priceLater")}</p>}
            </Panel>
            {o.invoices.length > 0 && (
              <Panel title={t("nav.invoices")}>
                <ul className="space-y-1">
                  {o.invoices.map((i) => (
                    <li key={i.id}>
                      <a href={`/api/portal/invoices/${i.id}/pdf`} target="_blank" rel="noopener" className="font-semibold underline">{i.number}</a>{" "}
                      <span className="text-sm text-muted-foreground">{ti(`statuses.${i.status}`)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            <Panel title={t("shareTitle")}>
              <p className="mb-2 text-sm text-muted-foreground">{t("shareText")}</p>
              <input readOnly aria-label={t("shareTitle")} value={link} className="w-full rounded-lg border border-input bg-muted px-2 py-2 font-mono text-xs" />
            </Panel>
          </div>
        </div>
      </main>
    </>
  );
}
