import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, Check, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireDriver } from "@/server/auth/guard";
import { DriverError, driverForUser, driverJob } from "@/server/driver/jobs";
import { driverIsMoving } from "@/server/driver/location";
import { LocationSharing } from "@/components/driver/location-sharing";
import { inspectionComplete, inspectionOpen, missingForInspection, nextDriverStep, type InspectionKind } from "@/server/driver/steps";
import { DriverHeader } from "@/components/driver/header";
import { StepButton } from "@/components/driver/step-button";
import { CashForm } from "@/components/driver/cash-form";
import { StatusBadge, fmtDateTime } from "@/components/admin/ui";
import { formatPhone, telHref, whatsappHref } from "@/lib/contact";
import { formatEur } from "@/lib/money";

export const metadata = { title: "Job" };

/** Google Maps turn-by-turn to a coordinate or an address. */
function navLink(lat: number | null, lng: number | null, address: string) {
  const dest = lat != null && lng != null ? `${lat},${lng}` : address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
}

export default async function JobPage({ params }: PageProps<"/driver/jobs/[id]">) {
  const user = await requireDriver();
  const { id } = await params;
  const [t, ts, tsv, locale] = await Promise.all([getTranslations("Driver"), getTranslations("Admin.status"), getTranslations("Admin.service"), getLocale()]);
  const driver = await driverForUser(user.id).catch(() => null);
  if (!driver) notFound();
  const job = await driverJob(driver.id, id).catch((err) => {
    if (err instanceof DriverError) return null;
    throw err;
  });
  if (!job) notFound();
  const { order, truck } = job;
  const moving = await driverIsMoving(driver.id);

  const step = nextDriverStep(order.status, order.service);
  const roadside = order.service === "ROADSIDE_ASSISTANCE";
  const insp = (k: InspectionKind) => order.inspections.find((i) => i.kind === k);
  const blocked = step?.needs ? !inspectionComplete(insp(step.needs), step.needs) : false;
  const paid = order.payments.reduce((s, p) => s + p.amountCents, 0);
  const price = order.finalCents ?? order.estimatedCents;
  const opts = (order.options ?? {}) as Record<string, boolean>;
  const flags = ["winch", "enclosed", "express", "highway"].filter((k) => opts[k]);

  return (
    <>
      <DriverHeader title={order.number} back="/driver" />
      <main className="mx-auto max-w-2xl space-y-4 p-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        {moving && <LocationSharing />}
        <section className="space-y-2 rounded-xl bg-card p-4">
          <p className="flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} label={ts(order.status)} />
            <span className="font-semibold">{tsv(order.service)}</span>
            {order.priority === "URGENT" && <span className="rounded-full bg-emergency px-2 text-sm font-bold text-emergency-foreground">{t("urgent")}</span>}
          </p>
          <p className="text-base text-muted-foreground">
            {order.isAsap ? t("asap") : fmtDateTime(job.assignment.plannedStart, locale)} · {truck?.name ?? truck?.plate}
          </p>
          {flags.length > 0 && <p className="text-base font-semibold">{flags.map((f) => t(`flags.${f}` as never)).join(" · ")}</p>}
        </section>

        {step && (
          <section className="space-y-2">
            {blocked && step.needs && (
              <Link href={`/driver/jobs/${order.id}/inspect/${step.needs.toLowerCase()}`} className="flex min-h-16 items-center justify-center gap-2 rounded-xl border-4 border-amber-500 bg-card text-xl font-bold">
                <Camera aria-hidden className="size-6" /> {t(step.needs === "PICKUP" ? "doPickupInspection" : "doDeliveryInspection")}
              </Link>
            )}
            <StepButton orderId={order.id} to={step.to} label={t(`actions.${step.action}`)} disabled={blocked} />
          </section>
        )}

        <section className="space-y-3 rounded-xl bg-card p-4">
          <h2 className="text-lg font-extrabold">{t("customer")}</h2>
          <p className="font-semibold">{order.customer.fullName}</p>
          <div className="grid grid-cols-2 gap-2">
            <a href={telHref(order.customer.phone)} className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-emergency font-semibold text-emergency-foreground">
              <Phone aria-hidden className="size-5" /> {t("call")}
            </a>
            <a href={whatsappHref(order.customer.phone)} target="_blank" rel="noopener noreferrer" className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-whatsapp font-semibold text-whatsapp-foreground">
              <MessageCircle aria-hidden className="size-5" /> WhatsApp
            </a>
          </div>
          <p className="text-base text-muted-foreground">{formatPhone(order.customer.phone)}</p>
        </section>

        <section className="space-y-3 rounded-xl bg-card p-4">
          <h2 className="text-lg font-extrabold">{t("route")}</h2>
          <Stop label={t("pickup")} address={order.pickupAddress} href={navLink(order.pickupLat, order.pickupLng, order.pickupAddress)} navigate={t("navigate")} />
          {order.dropoffAddress && <Stop label={t("dropoff")} address={order.dropoffAddress} href={navLink(order.dropoffLat, order.dropoffLng, order.dropoffAddress)} navigate={t("navigate")} />}
        </section>

        {order.vehicle && (
          <section className="rounded-xl bg-card p-4">
            <h2 className="text-lg font-extrabold">{t("vehicle")}</h2>
            <p className="mt-1">{[order.vehicle.make, order.vehicle.model, order.vehicle.year].filter(Boolean).join(" ")}</p>
            {order.vehicle.plate && <p className="font-mono text-xl font-bold">{order.vehicle.plate}</p>}
            <p className="text-base text-muted-foreground">{order.vehicle.isDrivable === false ? t("notDrivable") : order.vehicle.isDrivable ? t("drivable") : ""}</p>
          </section>
        )}

        {!roadside && (
          <section className="space-y-2 rounded-xl bg-card p-4">
            <h2 className="text-lg font-extrabold">{t("inspections")}</h2>
            {(["PICKUP", "DELIVERY"] as const).map((k) => {
              const i = insp(k);
              const done = inspectionComplete(i, k);
              const open = inspectionOpen(order.status, k) && !i?.signedAt;
              const missing = missingForInspection(i, k);
              const label = t(k === "PICKUP" ? "pickupInspection" : "deliveryInspection");
              const detail = done ? t("inspectionDone", { count: i?.photos.length ?? 0 }) : t("inspectionMissing", { count: missing.angles.length });
              return open ? (
                <Link key={k} href={`/driver/jobs/${order.id}/inspect/${k.toLowerCase()}`} className="flex min-h-14 items-center justify-between gap-2 rounded-lg border-2 border-border px-3">
                  <span className="font-semibold">{label}</span>
                  <span className="text-base text-muted-foreground">{detail}</span>
                </Link>
              ) : (
                <p key={k} className="flex min-h-14 items-center justify-between gap-2 px-3">
                  <span className="flex items-center gap-1 font-semibold">{done && <Check aria-hidden className="size-5 text-success" />}{label}</span>
                  <span className="text-base text-muted-foreground">{i ? detail : "–"}</span>
                </p>
              );
            })}
          </section>
        )}

        <section className="space-y-2 rounded-xl bg-card p-4">
          <h2 className="text-lg font-extrabold">{t("payment")}</h2>
          <p>{price != null ? t("price", { price: formatEur(price, locale) }) : t("noPrice")}</p>
          {paid > 0 && <p className="font-semibold text-success">{t("cashTotal", { amount: formatEur(paid, locale) })}</p>}
          {order.status !== "CANCELLED" && <CashForm orderId={order.id} suggestedEur={price != null && price > paid ? ((price - paid) / 100).toFixed(2) : ""} />}
        </section>

        {order.notes.length > 0 && (
          <section className="rounded-xl bg-card p-4">
            <h2 className="text-lg font-extrabold">{t("officeNotes")}</h2>
            <ul className="mt-2 space-y-2">
              {order.notes.map((n) => (
                <li key={n.id} className="text-base">
                  <p className="whitespace-pre-line">{n.body}</p>
                  <p className="text-sm text-muted-foreground">{n.author.name} · {fmtDateTime(n.createdAt, locale)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

function Stop({ label, address, href, navigate }: { label: string; address: string; href: string; navigate: string }) {
  return (
    <div className="flex items-start gap-3">
      <MapPin aria-hidden className="mt-1 size-5 shrink-0 text-primary dark:text-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="break-words font-semibold">{address}</p>
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer" className="flex min-h-12 shrink-0 items-center gap-1 rounded-lg bg-primary px-3 font-semibold text-primary-foreground">
        <Navigation aria-hidden className="size-5" /> {navigate}
      </a>
    </div>
  );
}
