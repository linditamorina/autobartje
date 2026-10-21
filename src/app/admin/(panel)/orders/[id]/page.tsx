import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, MessageCircle, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { allowedTransitions } from "@/server/orders/status";
import { presignDownload, storageConfigured } from "@/server/files/storage";
import { formatEur } from "@/lib/money";
import { telHref, whatsappHref } from "@/lib/contact";
import { Panel, StatusBadge, UrgentBadge, fmtDateTime } from "@/components/admin/ui";
import { NoteForm, PriceForm, StatusButtons } from "@/components/admin/order-forms";
import { AssignForm } from "@/components/admin/assign-form";
import { Button } from "@/components/ui/button";
import { unassignAction } from "@/app/admin/(panel)/dispatch/actions";
import { createFromOrderAction } from "@/app/admin/(panel)/invoices/actions";
import { assignChoices } from "@/server/dispatch/queries";
import { defaultDurationMin } from "@/server/dispatch/conflicts";
import { isOpen } from "@/server/orders/status";
import { roundedNow, toBusinessLocal } from "@/lib/time";
import { trackUrl } from "@/lib/tracking";

export default async function OrderDetailPage({ params, searchParams }: PageProps<"/admin/orders/[id]">) {
  const user = await requireStaff("orders.read");
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      statusEvents: { orderBy: { createdAt: "desc" } },
      notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      documents: { where: { type: "VEHICLE_PHOTO" } },
      assignments: { where: { isActive: true }, include: { driver: { include: { user: true } }, truck: true } },
      invoices: { where: { status: { not: "VOID" } }, select: { id: true, number: true, kind: true, status: true }, orderBy: { createdAt: "asc" } },
      inspections: { include: { photos: { orderBy: { createdAt: "asc" } }, driver: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: "asc" } },
      payments: { where: { status: { in: ["SUCCEEDED", "REFUNDED"] } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const [t, ts, tsv, tc, tp, locale] = await Promise.all([
    getTranslations("Admin.orders"),
    getTranslations("Admin.status"),
    getTranslations("Admin.service"),
    getTranslations("Admin.channel"),
    getTranslations("Admin.priority"),
    getLocale(),
  ]);
  const td = await getTranslations("Admin.dispatch");
  const ti = await getTranslations("Admin.invoices");
  const tdr = await getTranslations("Driver");
  const sp = await searchParams;
  const invoiceError = typeof sp.invoiceError === "string" && ["no_price", "exists", "not_found"].includes(sp.invoiceError) ? sp.invoiceError : null;
  const actorIds = [...new Set([...order.statusEvents.map((e) => e.actorId), ...order.payments.map((p) => p.receivedById)].filter(Boolean))] as string[];
  const actors = new Map((await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const photos = storageConfigured() ? await Promise.all(order.documents.map(async (d) => ({ id: d.id, url: await presignDownload(d.objectKey) }))) : [];
  const canUpdate = can(user.permissions, "orders.update");
  const canAssign = can(user.permissions, "orders.assign") && isOpen(order.status) && order.status !== "DRAFT";
  const choices = canAssign ? await assignChoices() : null;
  const assignment = order.assignments[0] ?? null;
  const priceValue = order.finalCents ?? order.estimatedCents;
  const defaultPrice = priceValue != null ? (priceValue / 100).toFixed(2) : "";
  const options = Object.entries((order.options as Record<string, unknown>) ?? {}).filter(([k, v]) => v === true && k !== "isDrivable").map(([k]) => k);
  const mapUrl = (lat: number | null, lng: number | null, address: string) =>
    lat != null && lng != null ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-flex min-h-10 items-center gap-1 font-semibold underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden className="size-4" /> {t("back")}
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold md:text-3xl">{t("detail", { number: order.number })}</h1>
        <StatusBadge status={order.status} label={ts(order.status)} />
        {order.priority === "URGENT" && <UrgentBadge label={tp("URGENT")} />}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title={t("customerSection")}>
              <p className="font-semibold">{order.customer.fullName}</p>
              <p>{order.customer.phone}</p>
              {order.customer.email && <p>{order.customer.email}</p>}
              <p className="text-sm text-muted-foreground">{t("preferred")}: {order.customer.preferredChannel}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={telHref(order.customer.phone)} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-emergency px-4 font-semibold text-emergency-foreground">
                  <Phone aria-hidden className="size-5" /> {t("callCustomer")}
                </a>
                <a href={whatsappHref(order.customer.phone, `${order.number}: `)} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-whatsapp px-4 font-semibold text-whatsapp-foreground">
                  <MessageCircle aria-hidden className="size-5" /> {t("whatsappCustomer")}
                </a>
              </div>
            </Panel>
            <Panel title={t("vehicleSection")}>
              <p className="font-semibold">{[order.vehicle?.make, order.vehicle?.model, order.vehicle?.year].filter(Boolean).join(" ") || "–"}</p>
              <p>{order.vehicle?.type} {order.vehicle?.plate && `· ${order.vehicle.plate}`}</p>
              {order.vehicle?.vin && <p className="font-mono text-sm">{order.vehicle.vin}</p>}
              <p>{order.vehicle?.isDrivable ? "✓ drivable" : "✗ not drivable"}</p>
              {order.vehicle?.condition && <p className="mt-2 text-sm">{order.vehicle.condition}</p>}
            </Panel>
          </div>

          <Panel title={t("routeSection")}>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">{tsv(order.service)}</dt>
                <dd>
                  <a className="inline-flex items-start gap-1 font-semibold underline-offset-4 hover:underline" href={mapUrl(order.pickupLat, order.pickupLng, order.pickupAddress)} target="_blank" rel="noopener">
                    <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" /> {order.pickupAddress}
                  </a>
                  {order.dropoffAddress && (
                    <a className="mt-1 flex items-start gap-1 underline-offset-4 hover:underline" href={mapUrl(order.dropoffLat, order.dropoffLng, order.dropoffAddress)} target="_blank" rel="noopener">
                      → {order.dropoffAddress}
                    </a>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t("when")}</dt>
                <dd className="font-semibold">{order.isAsap ? t("asap") : fmtDateTime(order.requestedAt ?? order.windowStart, locale)}{order.windowEnd && ` – ${fmtDateTime(order.windowEnd, locale)}`}</dd>
                {order.distanceKm != null && <dd className="text-sm">{t("distance")}: {order.distanceKm.toString()} km</dd>}
                {options.length > 0 && <dd className="text-sm">{t("options")}: {options.join(", ")}</dd>}
                <dd className="text-sm text-muted-foreground">{t("source")}: {tc(order.channel)}{order.leadSource && ` · ${order.leadSource}`}</dd>
              </div>
            </dl>
          </Panel>

          {photos.length > 0 && (
            <Panel title={t("photos")}>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((p) => (
                  <li key={p.id}>
                    <a href={p.url} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {order.inspections.length > 0 && (
            <Panel title={tdr("inspections")}>
              <div className="space-y-5">
                {order.inspections.map((i) => (
                  <section key={i.id} aria-label={tdr(i.kind === "PICKUP" ? "pickupInspection" : "deliveryInspection")}>
                    <h3 className="font-bold">{tdr(i.kind === "PICKUP" ? "pickupInspection" : "deliveryInspection")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {i.driver.user.name} · {fmtDateTime(i.signedAt ?? i.createdAt, locale)}
                      {i.odometerKm != null && ` · ${i.odometerKm.toLocaleString(locale)} km`}
                      {i.fuelLevel != null && ` · ${tdr("fuel")} ${i.fuelLevel} %`}
                    </p>
                    {i.notes && <p className="mt-1 whitespace-pre-wrap text-sm">{i.notes}</p>}
                    <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {i.photos.map((p) => (
                        <li key={p.id}>
                          <a href={`/api/files/inspection/${p.id}`} target="_blank" rel="noopener">
                            {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked image route */}
                            <img src={`/api/files/inspection/${p.id}`} alt={tdr(`angles.${p.angle}` as never)} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" />
                          </a>
                          <p className="text-xs text-muted-foreground">{tdr(`angles.${p.angle}` as never)} · {fmtDateTime(p.takenAt, locale)}</p>
                        </li>
                      ))}
                    </ul>
                    {i.signedAt && i.signatureKey && (
                      <figure className="mt-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked image route */}
                        <img src={`/api/files/inspection/sig-${i.id}`} alt={t("signature")} className="h-24 rounded-lg border border-border bg-white" />
                        <figcaption className="text-sm">{t("signedBy", { name: i.signerName ?? "–", date: fmtDateTime(i.signedAt, locale) })}</figcaption>
                      </figure>
                    )}
                  </section>
                ))}
              </div>
            </Panel>
          )}

          <Panel title={t("notes")}>
            <NoteForm orderId={order.id} />
            <ul className="mt-4 space-y-3">
              {order.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-muted p-3">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{n.author.name} · {fmtDateTime(n.createdAt, locale)}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title={t("price")}>
            <p className="text-3xl font-extrabold tabular-nums">{priceValue != null ? formatEur(priceValue, locale) : "–"}</p>
            {order.finalCents == null && order.estimatedCents != null && <p className="text-sm text-muted-foreground">{t("estimated")}</p>}
            {canUpdate && <div className="mt-3"><PriceForm orderId={order.id} defaultPrice={defaultPrice} /></div>}
          </Panel>
          <Panel title={t("trackingLink")}>
            <input readOnly aria-label={t("trackingLink")} value={trackUrl(order.trackingToken, order.locale)} className="w-full rounded-lg border border-input bg-muted px-2 py-2 font-mono text-xs" />
            <a href={trackUrl(order.trackingToken, order.locale)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold underline">{t("openTracking")}</a>
          </Panel>
          {order.payments.length > 0 && (
            <Panel title={t("payments")}>
              <ul className="space-y-1">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span>
                      {ti.has(`methods.${p.method}`) ? ti(`methods.${p.method}` as never) : p.method}
                      {p.stripePaymentIntentId && (
                        <a href={`https://dashboard.stripe.com/payments/${p.stripePaymentIntentId}`} target="_blank" rel="noopener noreferrer" className="ml-1 text-sm underline">Stripe</a>
                      )}
                      <span className="block text-xs text-muted-foreground">{(p.receivedById && actors.get(p.receivedById)) ?? "–"} · {fmtDateTime(p.receivedAt ?? p.createdAt, locale)}{p.status === "REFUNDED" ? ` · ${t("refunded")}` : !p.invoiceId && ` · ${t("notInvoiced")}`}</span>
                    </span>
                    <span className={p.status === "REFUNDED" ? "font-semibold tabular-nums line-through" : "font-semibold tabular-nums"}>{formatEur(p.amountCents, locale)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {can(user.permissions, "invoices.read") && (
            <Panel title={ti("title")}>
              {order.invoices.length > 0 ? (
                <ul className="space-y-1">
                  {order.invoices.map((i) => (
                    <li key={i.id}>
                      <Link href={`/admin/invoices/${i.id}`} className="font-semibold underline">
                        {i.number ? ti("viewInvoice", { number: i.number }) : ti("draftTitle")}
                      </Link>{" "}
                      <span className="text-sm text-muted-foreground">{ti(`statuses.${i.status}`)}</span>
                    </li>
                  ))}
                </ul>
              ) : can(user.permissions, "invoices.issue") ? (
                <form action={createFromOrderAction}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <Button type="submit" variant="secondary" disabled={priceValue == null}>{ti("createInvoice")}</Button>
                  {(priceValue == null || invoiceError) && <p className="mt-2 text-sm text-muted-foreground">{ti(`errors.${invoiceError ?? "no_price"}` as never)}</p>}
                </form>
              ) : null}
            </Panel>
          )}
          <Panel title={td("assignment")}>
            {assignment ? (
              <p className="mb-3 rounded-lg bg-muted p-3 text-sm">
                🚚 <span className="font-semibold">{assignment.driver.user.name}</span> · {assignment.truck.plate}
                <br />
                {fmtDateTime(assignment.plannedStart, locale)} – {fmtDateTime(assignment.plannedEnd, locale)}
              </p>
            ) : (
              <p className="mb-3 text-sm text-muted-foreground">{td("notAssigned")}</p>
            )}
            {choices && (
              <AssignForm
                orderId={order.id}
                drivers={choices.drivers}
                trucks={choices.trucks}
                current={assignment ? { driverId: assignment.driverId, truckId: assignment.truckId } : undefined}
                defaultStart={toBusinessLocal(assignment?.plannedStart ?? (order.requestedAt && !order.isAsap ? order.requestedAt : roundedNow()))}
                defaultDurationMin={
                  assignment ? Math.round((assignment.plannedEnd.getTime() - assignment.plannedStart.getTime()) / 60_000) : defaultDurationMin(order.service, order.durationMin)
                }
              />
            )}
            {choices && assignment && (
              <form action={unassignAction} className="mt-2">
                <input type="hidden" name="orderId" value={order.id} />
                <Button type="submit" variant="ghost" size="sm">{td("unassign")}</Button>
              </form>
            )}
          </Panel>
          {canUpdate && (
            <Panel title={t("changeStatus")}>
              <StatusButtons orderId={order.id} next={allowedTransitions(order.status)} needsPrice={order.finalCents == null} defaultPrice={defaultPrice} />
            </Panel>
          )}
          <Panel title={t("timeline")}>
            <ol className="space-y-3 border-l-2 border-border pl-4">
              {order.statusEvents.map((e) => (
                <li key={e.id}>
                  <StatusBadge status={e.to} label={ts(e.to)} />
                  <p className="text-sm text-muted-foreground">
                    {fmtDateTime(e.createdAt, locale)} · {e.actorId ? (actors.get(e.actorId) ?? "–") : "web"}
                  </p>
                  {e.note && <p className="text-sm">{e.note}</p>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
