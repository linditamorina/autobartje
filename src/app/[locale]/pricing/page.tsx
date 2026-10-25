import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell } from "@/components/marketing/page-shell";
import { formatEur, vatOf } from "@/lib/money";
import { alternates } from "@/lib/seo";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import type { RuleConditions } from "@/server/pricing/types";

// Prices change in admin; re-read them at most every 10 minutes.
export const revalidate = 600;

const DOMESTIC = ["EMERGENCY_TOWING", "ROADSIDE_ASSISTANCE", "DOMESTIC_TRANSPORT"] as const;
const SURCHARGES = ["night", "weekend", "holiday", "non_drivable", "winch", "express", "enclosed"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/pricing">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pages" });
  return { title: t("pricingTitle"), description: t("pricingIntro"), alternates: alternates("/pricing", locale) };
}

export default async function PricingPage({ params }: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tq, tr, settings, rules, tariffs] = await Promise.all([
    getTranslations("Pages"),
    getTranslations("Quote"),
    getTranslations("Admin.pricing.triggers"),
    getSettings(),
    db.pricingRule.findMany({ where: { isActive: true }, orderBy: { priority: "asc" } }).catch(() => []),
    db.routeTariff.findMany({ where: { isActive: true }, orderBy: [{ fromCountry: "asc" }, { fromCity: "asc" }, { priceCents: "asc" }] }).catch(() => []),
  ]);
  const vatBp = settings["vat.rateBp"];
  const gross = (net: number) => formatEur(net + vatOf(net, vatBp), locale);
  const pct = (bp: number) => `+${(bp / 100).toLocaleString(locale)} %`;
  const cond = (r: (typeof rules)[number]) => (r.conditions as RuleConditions | null) ?? {};
  const general = (kind: string) => rules.find((r) => r.kind === kind && !r.service && !r.vehicleType && !cond(r).minKm);

  const domestic = DOMESTIC.map((service) => ({
    service,
    base: rules.find((r) => r.kind === "BASE_FEE" && r.service === service) ?? general("BASE_FEE"),
    perKm: rules.find((r) => r.kind === "PER_KM" && r.service === service && !cond(r).minKm) ?? general("PER_KM"),
  }));
  const minimum = general("MINIMUM_PRICE");
  const surcharges = SURCHARGES.flatMap((trigger) => {
    const r = rules.find((x) => (x.kind === "SURCHARGE_PERCENT" || x.kind === "SURCHARGE_FIXED") && cond(x).trigger === trigger && !x.service);
    return r ? [{ label: tr(trigger), value: r.kind === "SURCHARGE_PERCENT" ? pct(r.amount) : `+${gross(r.amount)}` }] : [];
  });
  const vehicles = rules.filter((r) => r.vehicleType && r.kind === "SURCHARGE_FIXED" && !r.service);
  const country = (c: string) => (tq.has(`countries.${c}`) ? tq(`countries.${c}` as never) : c);

  return (
    <PageShell crumbs={[{ href: "/pricing", label: t("pricingTitle") }]} title={t("pricingTitle")} lead={t("pricingIntro")}>
      <section aria-labelledby="domestic">
        <h2 id="domestic" className="mb-3 text-2xl font-extrabold">{t("pricingDomestic")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-lg">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="p-2">{t("pricingService")}</th>
                <th className="p-2">{t("pricingCallout")}</th>
                <th className="p-2">{t("pricingPerKm")}</th>
              </tr>
            </thead>
            <tbody>
              {domestic.map((d) => (
                <tr key={d.service} className="border-b border-border">
                  <td className="p-2 font-semibold">{tq(`services.${d.service}` as never)}</td>
                  <td className="p-2">{d.base ? gross(d.base.amount) : "–"}</td>
                  <td className="p-2">{d.perKm ? gross(d.perKm.amount) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {minimum && <p className="mt-2 text-muted-foreground">{t("pricingMinimum", { price: gross(minimum.amount) })}</p>}
      </section>

      {(surcharges.length > 0 || vehicles.length > 0) && (
        <section aria-labelledby="extras" className="mt-10">
          <h2 id="extras" className="mb-3 text-2xl font-extrabold">{t("pricingExtras")}</h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            {[...surcharges, ...vehicles.map((v) => ({ label: tq(`vehicleTypes.${v.vehicleType}` as never), value: `+${gross(v.amount)}` }))].map((s) => (
              <div key={s.label} className="flex justify-between gap-3 rounded-lg border border-border p-3">
                <dt>{s.label}</dt>
                <dd className="font-bold whitespace-nowrap">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {tariffs.length > 0 && (
        <section aria-labelledby="import" className="mt-10">
          <h2 id="import" className="mb-3 text-2xl font-extrabold">{t("pricingImport")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-lg">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="p-2">{t("pricingFrom")}</th>
                  <th className="p-2">{t("pricingOpen")}</th>
                  <th className="p-2">{t("pricingEnclosed")}</th>
                  <th className="p-2">{t("pricingDays")}</th>
                </tr>
              </thead>
              <tbody>
                {tariffs.map((r) => (
                  <tr key={r.id} className="border-b border-border">
                    <td className="p-2 font-semibold">
                      {[r.fromCity, country(r.fromCountry)].filter(Boolean).join(", ")}
                      {r.vehicleType && <span className="block text-sm font-normal text-muted-foreground">{tq(`vehicleTypes.${r.vehicleType}` as never)}</span>}
                      {r.includesCustoms && <span className="block text-sm font-normal text-muted-foreground">{t("pricingCustomsIncluded")}</span>}
                    </td>
                    <td className="p-2">{gross(r.priceCents)}</td>
                    <td className="p-2">{r.enclosedCents ? gross(r.enclosedCents) : "–"}</td>
                    <td className="p-2">{r.transitDays ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="mt-8 rounded-lg bg-muted p-4">{t("pricingNote", { vat: vatBp / 100 })}</p>
    </PageShell>
  );
}
