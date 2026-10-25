import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import type { RuleConditions } from "@/server/pricing/types";
import { ORIGIN_COUNTRIES, SERVICES, VEHICLE_TYPES } from "@/lib/validation/booking";
import { formatEur } from "@/lib/money";
import { dateInputValue } from "@/lib/form";
import { PageHeader, Panel, fmtDate } from "@/components/admin/ui";
import { FieldsForm, type FieldDef } from "@/components/admin/fields-form";
import { PriceSimulator, RuleRow } from "@/components/admin/pricing-forms";
import { cn } from "@/lib/utils";
import { createRuleAction, saveDiscountAction, saveTariffAction } from "./actions";

export const metadata = { title: "Prices" };

const TABS = ["rules", "routes", "codes", "test"] as const;
type Tab = (typeof TABS)[number];
const TRIGGERS = ["always", "night", "weekend", "holiday", "non_drivable", "winch", "enclosed", "express", "highway", "customs", "export_plates"] as const;
const KIND_ORDER = ["BASE_FEE", "PER_KM", "MINIMUM_PRICE", "SURCHARGE_PERCENT", "SURCHARGE_FIXED", "PER_HOUR"];
const hundredths = (n: number | null | undefined) => (n == null ? "" : (n / 100).toFixed(2).replace(/\.00$/, ""));

export default async function PricingPage({ searchParams }: PageProps<"/admin/pricing">) {
  const user = await requireStaff("pricing.read");
  const editable = can(user.permissions, "pricing.manage");
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "rules";
  const [t, tsv, tq, locale] = await Promise.all([getTranslations("Admin.pricing"), getTranslations("Admin.service"), getTranslations("Quote"), getLocale()]);

  const serviceOpts = [{ value: "", label: t("allServices") }, ...SERVICES.map((s) => ({ value: s, label: tsv(s) }))];
  const vehicleOpts = [{ value: "", label: t("allVehicles") }, ...VEHICLE_TYPES.map((v) => ({ value: v, label: tq(`vehicleTypes.${v}`) }))];
  const errors = { duplicate: t("duplicate") };

  return (
    <>
      <PageHeader title={t("title")} />
      <nav className="mb-4 flex flex-wrap gap-1 border-b border-border" aria-label={t("title")}>
        {TABS.map((k) => (
          <Link key={k} href={`?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={cn("-mb-px border-b-4 px-3 py-2 font-semibold", tab === k ? "border-primary" : "border-transparent text-muted-foreground")}>
            {t(`tabs.${k}`)}
          </Link>
        ))}
      </nav>
      <p className="mb-4 text-sm text-muted-foreground">{t("intro")}{!editable && ` ${t("readOnly")}`}</p>

      {tab === "rules" && <RulesTab />}
      {tab === "routes" && <RoutesTab />}
      {tab === "codes" && <CodesTab />}
      {tab === "test" && <Panel><PriceSimulator /></Panel>}
    </>
  );

  async function RulesTab() {
    const rules = await db.pricingRule.findMany({ orderBy: [{ priority: "asc" }, { name: "asc" }] });
    rules.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
    const fields: FieldDef[] = [
      { name: "name", label: t("name"), required: true },
      { name: "kind", label: t("kind"), type: "select", defaultValue: "SURCHARGE_FIXED", options: KIND_ORDER.filter((k) => k !== "PER_HOUR").map((k) => ({ value: k, label: t(`kinds.${k}` as never) })) },
      { name: "amount", label: t("amount"), required: true },
      { name: "trigger", label: t("trigger"), type: "select", options: [{ value: "", label: "–" }, ...TRIGGERS.map((k) => ({ value: k, label: t(`triggers.${k}`) }))] },
      { name: "service", label: t("service"), type: "select", options: serviceOpts },
      { name: "vehicleType", label: t("vehicle"), type: "select", options: vehicleOpts },
    ];
    return (
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Panel>
          <div className="divide-y divide-border">
            {rules.map((r) => {
              const c = (r.conditions as RuleConditions | null) ?? {};
              const scope = [r.service ? tsv(r.service) : t("allServices"), r.vehicleType ? tq(`vehicleTypes.${r.vehicleType}`) : null, c.trigger && c.trigger !== "always" ? t(`triggers.${c.trigger}` as never) : null]
                .filter(Boolean)
                .join(" · ");
              return (
                <RuleRow
                  key={r.id}
                  editable={editable}
                  rule={{
                    id: r.id,
                    name: r.name,
                    kind: r.kind,
                    amount: hundredths(r.amount),
                    isActive: r.isActive,
                    scope,
                    fromHour: c.fromHour,
                    toHour: c.toHour,
                    minKm: c.minKm,
                    hasHours: c.trigger === "night",
                    hasMinKm: r.kind === "PER_KM" && c.minKm != null,
                  }}
                />
              );
            })}
          </div>
        </Panel>
        {editable && (
          <Panel title={t("addRule")}>
            <FieldsForm action={createRuleAction} fields={fields} submitLabel={t("addRule")} resetOnSuccess />
          </Panel>
        )}
      </div>
    );
  }

  async function RoutesTab() {
    const tariffs = await db.routeTariff.findMany({ orderBy: [{ fromCountry: "asc" }, { fromCity: "asc" }, { vehicleType: "asc" }] });
    const fieldsFor = (x?: (typeof tariffs)[number]): FieldDef[] => [
      { name: "fromCountry", label: t("from"), type: "select", defaultValue: x?.fromCountry ?? "DE", options: ORIGIN_COUNTRIES.filter((c) => c !== "OTHER").map((c) => ({ value: c, label: tq(`countries.${c}`) })) },
      { name: "fromCity", label: t("fromCity"), defaultValue: x?.fromCity },
      { name: "toCountry", label: t("toCountry"), defaultValue: x?.toCountry ?? "XK" },
      { name: "toCity", label: t("toCity"), defaultValue: x?.toCity },
      { name: "vehicleType", label: t("vehicle"), type: "select", defaultValue: x?.vehicleType ?? "", options: vehicleOpts },
      { name: "price", label: t("price"), required: true, defaultValue: hundredths(x?.priceCents) },
      { name: "enclosedPrice", label: t("enclosedPrice"), defaultValue: hundredths(x?.enclosedCents) },
      { name: "transitDays", label: t("transitDays"), type: "number", defaultValue: x?.transitDays },
      { name: "includesCustoms", label: t("customs"), type: "checkbox", defaultValue: x?.includesCustoms ?? false },
      { name: "isActive", label: t("active"), type: "checkbox", defaultValue: x?.isActive ?? true },
    ];
    return (
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Panel>
          <ul className="divide-y divide-border">
            {tariffs.map((x) => (
              <li key={x.id} className={cn("py-3", !x.isActive && "opacity-60")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {tq(`countries.${x.fromCountry}` as never)}{x.fromCity && ` (${x.fromCity})`} → {x.toCountry}{x.toCity && ` (${x.toCity})`}
                    {x.vehicleType && <span className="font-normal text-muted-foreground"> · {tq(`vehicleTypes.${x.vehicleType}`)}</span>}
                  </span>
                  <span className="tabular-nums">
                    {formatEur(x.priceCents, locale)}
                    {x.enclosedCents != null && <span className="text-muted-foreground"> / {formatEur(x.enclosedCents, locale)}</span>}
                    {x.transitDays && <span className="text-muted-foreground"> · {x.transitDays} d</span>}
                  </span>
                </div>
                {editable && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-primary">{t("edit")}</summary>
                    <div className="mt-2"><FieldsForm action={saveTariffAction} fields={fieldsFor(x)} hidden={{ id: x.id }} submitLabel={t("save")} errors={errors} /></div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </Panel>
        {editable && (
          <Panel title={t("addRoute")}>
            <FieldsForm action={saveTariffAction} fields={fieldsFor()} submitLabel={t("addRoute")} errors={errors} resetOnSuccess />
          </Panel>
        )}
      </div>
    );
  }

  async function CodesTab() {
    const codes = await db.discountCode.findMany({ orderBy: [{ isActive: "desc" }, { code: "asc" }] });
    const fieldsFor = (x?: (typeof codes)[number]): FieldDef[] => [
      { name: "code", label: t("code"), required: true, defaultValue: x?.code },
      { name: "maxUses", label: t("maxUses"), type: "number", defaultValue: x?.maxUses },
      { name: "percent", label: t("percent"), defaultValue: hundredths(x?.percentBp), help: t("oneDiscount") },
      { name: "fixed", label: t("fixed"), defaultValue: hundredths(x?.fixedCents) },
      { name: "validFrom", label: t("validFrom"), type: "date", defaultValue: dateInputValue(x?.validFrom) },
      { name: "validTo", label: t("validTo"), type: "date", defaultValue: dateInputValue(x?.validTo) },
      { name: "isActive", label: t("active"), type: "checkbox", defaultValue: x?.isActive ?? true },
    ];
    return (
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Panel>
          {codes.length === 0 && <p className="text-muted-foreground">–</p>}
          <ul className="divide-y divide-border">
            {codes.map((x) => (
              <li key={x.id} className={cn("py-3", !x.isActive && "opacity-60")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <code className="font-bold">{x.code}</code>
                  <span className="text-sm">
                    {x.percentBp != null ? `−${x.percentBp / 100}%` : x.fixedCents != null ? `−${formatEur(x.fixedCents, locale)}` : ""} · {t("used")} {x.usedCount}{x.maxUses ? `/${x.maxUses}` : ""}
                    {x.validTo && ` · ${t("validTo")} ${fmtDate(x.validTo, locale)}`}
                  </span>
                </div>
                {editable && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-primary">{t("edit")}</summary>
                    <div className="mt-2"><FieldsForm action={saveDiscountAction} fields={fieldsFor(x)} hidden={{ id: x.id }} submitLabel={t("save")} errors={errors} /></div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </Panel>
        {editable && (
          <Panel title={t("addCode")}>
            <FieldsForm action={saveDiscountAction} fields={fieldsFor()} submitLabel={t("addCode")} errors={errors} resetOnSuccess />
          </Panel>
        )}
      </div>
    );
  }
}
