import type { PricingRule, RouteTariff } from "./types";

/**
 * Starting price list used by the seed and tests. Placeholder values:
 * the owner edits them in /admin/pricing. Amounts are net (excl. VAT).
 */
const rule = (r: Partial<PricingRule> & Pick<PricingRule, "key" | "name" | "kind" | "amount">): PricingRule => ({
  service: null,
  vehicleType: null,
  conditions: null,
  priority: 100,
  isActive: true,
  validFrom: null,
  validTo: null,
  ...r,
});

export const DEFAULT_PRICING_RULES: PricingRule[] = [
  rule({ key: "base", name: "Base fee", kind: "BASE_FEE", amount: 3000 }),
  rule({ key: "base_emergency", name: "Emergency call-out", kind: "BASE_FEE", amount: 4000, service: "EMERGENCY_TOWING" }),
  rule({ key: "base_roadside", name: "Roadside assistance call-out", kind: "BASE_FEE", amount: 2500, service: "ROADSIDE_ASSISTANCE" }),
  rule({ key: "per_km", name: "Per km", kind: "PER_KM", amount: 100 }),
  rule({ key: "per_km_long", name: "Per km (over 150 km)", kind: "PER_KM", amount: 80, conditions: { minKm: 150 }, priority: 50 }),
  rule({ key: "night", name: "Night (22:00–06:00)", kind: "SURCHARGE_PERCENT", amount: 2500, conditions: { trigger: "night", fromHour: 22, toHour: 6 } }),
  rule({ key: "weekend", name: "Weekend", kind: "SURCHARGE_PERCENT", amount: 1500, conditions: { trigger: "weekend" } }),
  rule({ key: "holiday", name: "Public holiday", kind: "SURCHARGE_PERCENT", amount: 3000, conditions: { trigger: "holiday" } }),
  rule({ key: "express", name: "Express", kind: "SURCHARGE_PERCENT", amount: 2000, conditions: { trigger: "express" } }),
  rule({ key: "enclosed", name: "Enclosed transport", kind: "SURCHARGE_PERCENT", amount: 4000, conditions: { trigger: "enclosed" } }),
  rule({ key: "non_drivable", name: "Non-drivable vehicle", kind: "SURCHARGE_FIXED", amount: 2000, conditions: { trigger: "non_drivable" } }),
  rule({ key: "winch", name: "Winch recovery", kind: "SURCHARGE_FIXED", amount: 2500, conditions: { trigger: "winch" } }),
  rule({ key: "highway", name: "Highway", kind: "SURCHARGE_FIXED", amount: 1000, conditions: { trigger: "highway" } }),
  rule({ key: "customs", name: "Customs assistance", kind: "SURCHARGE_FIXED", amount: 8000, conditions: { trigger: "customs" } }),
  rule({ key: "export_plates", name: "Export plates", kind: "SURCHARGE_FIXED", amount: 12000, conditions: { trigger: "export_plates" } }),
  rule({ key: "vehicle_suv", name: "SUV", kind: "SURCHARGE_FIXED", amount: 1000, vehicleType: "SUV", conditions: { trigger: "always" } }),
  rule({ key: "vehicle_van", name: "Van", kind: "SURCHARGE_FIXED", amount: 1500, vehicleType: "VAN", conditions: { trigger: "always" } }),
  rule({ key: "vehicle_luxury", name: "Luxury / low car", kind: "SURCHARGE_FIXED", amount: 2500, vehicleType: "LUXURY_LOW", conditions: { trigger: "always" } }),
  rule({ key: "waiting", name: "Waiting time", kind: "PER_HOUR", amount: 1500 }),
  rule({ key: "minimum", name: "Minimum price", kind: "MINIMUM_PRICE", amount: 3500 }),
];

const tariff = (t: Partial<RouteTariff> & Pick<RouteTariff, "fromCountry" | "priceCents">): RouteTariff => ({
  fromCity: null,
  toCountry: "XK",
  toCity: null,
  vehicleType: null,
  enclosedCents: null,
  transitDays: null,
  includesCustoms: false,
  isActive: true,
  ...t,
});

export const DEFAULT_ROUTE_TARIFFS: RouteTariff[] = [
  tariff({ fromCountry: "DE", priceCents: 65000, enclosedCents: 95000, transitDays: 4 }),
  tariff({ fromCountry: "DE", fromCity: "München", priceCents: 60000, enclosedCents: 88000, transitDays: 3 }),
  tariff({ fromCountry: "AT", priceCents: 55000, enclosedCents: 82000, transitDays: 3 }),
  tariff({ fromCountry: "CH", priceCents: 75000, enclosedCents: 105000, transitDays: 4, includesCustoms: true }),
  tariff({ fromCountry: "DE", vehicleType: "VAN", priceCents: 80000, transitDays: 4 }),
];
