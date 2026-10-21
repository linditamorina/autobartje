import { applyBp, VAT_RATE_BP, vatOf } from "@/lib/money";
import type {
  ContractPrice,
  PriceLine,
  PriceResult,
  PriceSource,
  PriceUnavailable,
  PricingContext,
  PricingInput,
  PricingRule,
  RouteTariff,
  SurchargeTrigger,
} from "./types";

const DEFAULT_TZ = "Europe/Belgrade"; // Kosovo is on CET/CEST

/**
 * Calculates an estimated price. Pure function: everything it needs comes in
 * through `input` and `ctx`, so it is fully unit-testable.
 *
 * Order of evaluation:
 *   1. Base: B2B contract price, else fixed route tariff (international), else base fee + €/km rules
 *   2. Surcharges in rule priority order (percentages apply to the base, never compound)
 *   3. Waiting hours and tolls
 *   4. Minimum price
 *   5. Contract discount, then discount code
 *   6. VAT
 */
export function calculatePrice(
  input: PricingInput,
  ctx: PricingContext,
): PriceResult | PriceUnavailable {
  const now = ctx.now ?? new Date();
  const at = input.pickupAt ?? now;
  const tz = ctx.timeZone ?? DEFAULT_TZ;
  const km = Math.max(0, input.distanceKm);
  const rules = activeRules(ctx.rules, input, at);
  const lines: PriceLine[] = [];

  // 1. Base
  let source: PriceSource = "rules";
  let transitDays: number | null = null;
  let includesCustoms = false;
  const contract = findContract(ctx.contract ?? [], input, at);

  if (contract && (contract.baseCents != null || contract.perKmCents != null)) {
    source = "contract";
    if (contract.baseCents) lines.push({ key: "base", label: "Base fee (contract)", cents: contract.baseCents });
    if (contract.perKmCents) {
      lines.push({ key: "per_km", label: `${formatKm(km)} km (contract)`, cents: Math.round(km * contract.perKmCents) });
    }
  } else if (input.service === "INTERNATIONAL_TRANSPORT") {
    const tariff = findRouteTariff(ctx.routeTariffs ?? [], input);
    if (!tariff) return { ok: false, reason: "no_route_tariff" };
    source = "route_tariff";
    transitDays = tariff.transitDays;
    includesCustoms = tariff.includesCustoms;
    const enclosed = input.options.enclosed && tariff.enclosedCents != null;
    lines.push({
      key: "route",
      label: enclosed ? "Route price (enclosed)" : "Route price",
      cents: enclosed ? tariff.enclosedCents! : tariff.priceCents,
    });
  } else {
    const base = rules.find((r) => r.kind === "BASE_FEE");
    const perKm = rules.find((r) => r.kind === "PER_KM" && kmInRange(r, km));
    if (!base && !perKm) return { ok: false, reason: "no_base_rule" };
    if (base) lines.push({ key: base.key, label: base.name, cents: base.amount });
    if (perKm) lines.push({ key: perKm.key, label: `${formatKm(km)} km × ${perKm.amount / 100} €`, cents: Math.round(km * perKm.amount) });
  }
  const baseCents = sum(lines);

  // 2. Surcharges
  const triggers = activeTriggers(input, at, tz, ctx.holidays ?? []);
  for (const rule of rules) {
    if (rule.kind !== "SURCHARGE_PERCENT" && rule.kind !== "SURCHARGE_FIXED") continue;
    const trigger = rule.conditions?.trigger ?? "always";
    if (!triggers.has(trigger) || !kmInRange(rule, km)) continue;
    if (!nightMatches(rule, at, tz, trigger)) continue;
    if (trigger === "customs" && includesCustoms) continue;
    // A fixed international route price already covers time-of-day and enclosed handling.
    if (source === "route_tariff" && ["night", "weekend", "holiday", "enclosed"].includes(trigger)) continue;
    const cents = rule.kind === "SURCHARGE_PERCENT" ? applyBp(baseCents, rule.amount) : rule.amount;
    lines.push({ key: rule.key, label: rule.name, cents });
  }

  // 3. Waiting time and tolls
  const waiting = rules.find((r) => r.kind === "PER_HOUR");
  if (waiting && input.waitingHours && input.waitingHours > 0) {
    lines.push({ key: waiting.key, label: `${waiting.name} (${input.waitingHours} h)`, cents: Math.round(input.waitingHours * waiting.amount) });
  }
  if (input.tollsCents && input.tollsCents > 0) {
    lines.push({ key: "tolls", label: "Tolls", cents: input.tollsCents });
  }

  // 4. Minimum price
  const minimum = rules.find((r) => r.kind === "MINIMUM_PRICE");
  const before = sum(lines);
  if (minimum && before < minimum.amount) {
    lines.push({ key: minimum.key, label: minimum.name, cents: minimum.amount - before });
  }

  // 5. Discounts
  if (contract?.discountBp) {
    lines.push({ key: "contract_discount", label: "Contract discount", cents: -applyBp(sum(lines), contract.discountBp) });
  }
  const discount = ctx.discount;
  if (discount && discountUsable(discount, now)) {
    const current = sum(lines);
    let off = 0;
    if (discount.percentBp) off = applyBp(current, discount.percentBp);
    else if (discount.fixedCents) off = Math.min(discount.fixedCents, current);
    if (off > 0) lines.push({ key: "discount", label: `Discount ${discount.code}`, cents: -off });
  }

  // 6. VAT
  const netCents = Math.max(0, sum(lines));
  const vatCents = vatOf(netCents, ctx.vatRateBp ?? VAT_RATE_BP);
  return { ok: true, source, lines, netCents, vatCents, totalCents: netCents + vatCents, transitDays };
}

function activeRules(rules: PricingRule[], input: PricingInput, at: Date): PricingRule[] {
  return rules
    .filter(
      (r) =>
        r.isActive &&
        (r.service == null || r.service === input.service) &&
        (r.vehicleType == null || r.vehicleType === input.vehicleType) &&
        (r.validFrom == null || r.validFrom <= at) &&
        (r.validTo == null || r.validTo > at),
    )
    // Specific rules (service / vehicle) win over generic ones of the same kind, then by priority.
    .sort((a, b) => specificity(b) - specificity(a) || a.priority - b.priority);
}

function specificity(r: PricingRule): number {
  return (r.service ? 2 : 0) + (r.vehicleType ? 1 : 0);
}

function kmInRange(r: PricingRule, km: number): boolean {
  const c = r.conditions;
  if (!c) return true;
  return (c.minKm == null || km >= c.minKm) && (c.maxKm == null || km < c.maxKm);
}

function activeTriggers(input: PricingInput, at: Date, tz: string, holidays: string[]): Set<SurchargeTrigger> {
  const t = new Set<SurchargeTrigger>(["always", "night"]); // night is checked per rule window
  const { weekday, date } = localParts(at, tz);
  if (weekday === 0 || weekday === 6) t.add("weekend");
  if (holidays.includes(date)) t.add("holiday");
  if (!input.isDrivable) t.add("non_drivable");
  const o = input.options;
  if (o.winch) t.add("winch");
  if (o.enclosed) t.add("enclosed");
  if (o.express) t.add("express");
  if (o.highway) t.add("highway");
  if (o.customs) t.add("customs");
  if (o.exportPlates) t.add("export_plates");
  return t;
}

function nightMatches(rule: PricingRule, at: Date, tz: string, trigger: SurchargeTrigger): boolean {
  if (trigger !== "night") return true;
  const from = rule.conditions?.fromHour ?? 22;
  const to = rule.conditions?.toHour ?? 6;
  const { hour } = localParts(at, tz);
  return from > to ? hour >= from || hour < to : hour >= from && hour < to;
}

export function localParts(at: Date, tz: string): { hour: number; weekday: number; date: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    hour: Number(get("hour")),
    weekday: weekdays.indexOf(get("weekday")),
    date: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

function findRouteTariff(tariffs: RouteTariff[], input: PricingInput): RouteTariff | null {
  const route = input.international;
  if (!route) return null;
  const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
  const candidates = tariffs.filter(
    (t) =>
      t.isActive &&
      t.fromCountry === route.fromCountry &&
      t.toCountry === route.toCountry &&
      (t.fromCity == null || norm(t.fromCity) === norm(route.fromCity)) &&
      (t.toCity == null || norm(t.toCity) === norm(route.toCity)) &&
      (t.vehicleType == null || t.vehicleType === input.vehicleType),
  );
  const score = (t: RouteTariff) => (t.fromCity ? 4 : 0) + (t.toCity ? 2 : 0) + (t.vehicleType ? 1 : 0);
  return candidates.sort((a, b) => score(b) - score(a))[0] ?? null;
}

function findContract(prices: ContractPrice[], input: PricingInput, at: Date): ContractPrice | null {
  const valid = prices.filter(
    (p) =>
      p.service === input.service &&
      (p.vehicleType == null || p.vehicleType === input.vehicleType) &&
      p.validFrom <= at &&
      (p.validTo == null || p.validTo > at),
  );
  return valid.sort((a, b) => (b.vehicleType ? 1 : 0) - (a.vehicleType ? 1 : 0))[0] ?? null;
}

export function discountUsable(d: NonNullable<PricingContext["discount"]>, now: Date): boolean {
  return (
    d.isActive &&
    (d.validFrom == null || d.validFrom <= now) &&
    (d.validTo == null || d.validTo > now) &&
    (d.maxUses == null || d.usedCount < d.maxUses)
  );
}

function sum(lines: PriceLine[]): number {
  return lines.reduce((acc, l) => acc + l.cents, 0);
}

function formatKm(km: number): string {
  return (Math.round(km * 10) / 10).toString();
}
