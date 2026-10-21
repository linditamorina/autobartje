import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, Circle, MapPin, MessageCircle, Phone, Truck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LiveRefresh } from "@/components/tracking/live-refresh";
import { formatPhone, telHref, whatsappHref } from "@/lib/contact";
import { formatEur } from "@/lib/money";
import { BUSINESS_TZ } from "@/lib/time";
import { trackingSteps } from "@/lib/tracking";
import { cn } from "@/lib/utils";
import { getTracking } from "@/server/orders/tracking";
import { getSettings } from "@/server/settings";

// The link is private to the customer: never indexed, never cached, no referrer to other sites.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function TrackPage({ params }: PageProps<"/[locale]/track/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const [t, tsv, s, tr] = await Promise.all([getTranslations("Track"), getTranslations("Admin.service"), getSettings(), getTracking(token)]);
  if (!tr) notFound();
  const fmt = (d: Date) => new Intl.DateTimeFormat(locale, { timeZone: BUSINESS_TZ, dateStyle: "medium", timeStyle: "short" }).format(d);

  if (tr.expired) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-extrabold">{t("expiredTitle")}</h1>
        <p className="mt-3">{t("expiredText")}</p>
        <Button asChild variant="emergency" size="lg" className="mt-6">
          <a href={telHref(s["contact.phone"])}><Phone aria-hidden /> {formatPhone(s["contact.phone"])}</a>
        </Button>
      </div>
    );
  }

  const steps = trackingSteps(tr.status, tr.service);
  const reached = new Map<string, Date>();
  for (const e of tr.events) reached.set(e.status, e.at);
  const cancelled = tr.status === "CANCELLED";
  const live = !cancelled && tr.status !== "DELIVERED" && tr.status !== "COMPLETED";

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
      {live && <LiveRefresh seconds={20} />}
      <div>
        <p className="text-sm font-semibold text-muted-foreground">{tsv(tr.service)}</p>
        <h1 className="text-2xl font-extrabold">{t("title", { number: tr.number })}</h1>
        <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">{t("updated", { time: fmt(tr.updatedAt) })}{live && ` · ${t("liveHint")}`}</p>
      </div>

      {cancelled ? (
        <p role="status" className="rounded-xl border-2 border-destructive p-4 font-semibold">{t("cancelled")}</p>
      ) : (
        <ol className="rounded-xl border border-border bg-card p-4" aria-label={t("progress")}>
          {steps.map((step, i) => (
            <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0" aria-current={step.state === "current" ? "step" : undefined}>
              {i < steps.length - 1 && <span aria-hidden className={cn("absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5", step.state === "done" ? "bg-success" : "bg-border")} />}
              <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-full border-2", step.state === "done" ? "border-success bg-success text-white" : step.state === "current" ? "border-primary bg-primary text-primary-foreground dark:border-foreground" : "border-border text-muted-foreground")}>
                {step.state === "done" ? <Check className="size-5" /> : step.state === "current" ? <Truck className="size-4" /> : <Circle className="size-3" />}
              </span>
              <div className="min-w-0 pt-1">
                <p className={cn("font-semibold", step.state === "todo" && "text-muted-foreground", step.state === "current" && "text-lg font-extrabold")}>
                  {t(`steps.${tr.service === "ROADSIDE_ASSISTANCE" && step.key === "PICKED_UP" ? "ARRIVED" : step.key}`)}
                </p>
                {step.state === "current" && <p className="text-sm">{t(`hints.${step.key}`)}</p>}
                {reached.get(step.key) && step.state !== "todo" && <p className="text-sm text-muted-foreground">{fmt(reached.get(step.key)!)}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      <dl className="space-y-3 rounded-xl border border-border bg-card p-4">
        {(tr.plannedAt || tr.isAsap) && (
          <div>
            <dt className="text-sm text-muted-foreground">{t("when")}</dt>
            <dd className="font-semibold">{tr.isAsap ? t("asap") : fmt(tr.plannedAt!)}</dd>
          </div>
        )}
        <div>
          <dt className="text-sm text-muted-foreground">{t("route")}</dt>
          <dd className="flex items-start gap-1 font-semibold"><MapPin aria-hidden className="mt-1 size-4 shrink-0" /> {tr.pickupAddress}</dd>
          {tr.dropoffAddress && <dd className="pl-5">→ {tr.dropoffAddress}</dd>}
        </div>
        {tr.driverName && (
          <div>
            <dt className="text-sm text-muted-foreground">{t("driver")}</dt>
            <dd className="font-semibold">{tr.driverName}{tr.truckPlate && ` · ${tr.truckPlate}`}</dd>
          </div>
        )}
        {tr.priceCents != null && (
          <div>
            <dt className="text-sm text-muted-foreground">{tr.priceFinal ? t("price") : t("estimate")}</dt>
            <dd className="text-xl font-extrabold tabular-nums">{formatEur(tr.priceCents, locale)}</dd>
          </div>
        )}
      </dl>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild variant="emergency" size="lg">
          <a href={telHref(s["contact.phone"])} data-track="call_click"><Phone aria-hidden /> {t("call")}</a>
        </Button>
        <Button asChild variant="whatsapp" size="lg">
          <a href={whatsappHref(s["contact.whatsapp"], t("whatsappText", { number: tr.number }))} target="_blank" rel="noopener noreferrer" data-track="whatsapp_click">
            <MessageCircle aria-hidden /> WhatsApp
          </a>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("privacy")} <Link href="/legal/privacy" className="underline">{t("privacyLink")}</Link>
      </p>
    </div>
  );
}
