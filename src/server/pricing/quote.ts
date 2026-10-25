import "server-only";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { routeDistance, type RouteEstimate } from "@/server/maps/distance";
import type { QuoteInput } from "@/lib/validation/booking";
import { calculatePrice } from "./engine";
import type { ContractPrice, DiscountCode, PriceLine, PricingRule, RouteTariff, RuleConditions } from "./types";

export interface QuoteResult {
  quoteId: string | null;
  available: boolean;
  /** Why no price could be shown; the operator will call back with one. */
  reason?: "no_route_tariff" | "no_base_rule" | "no_coordinates";
  lines: PriceLine[];
  netCents: number;
  vatCents: number;
  totalCents: number;
  distanceKm: number | null;
  durationMin: number | null;
  distanceSource: RouteEstimate["source"] | null;
  transitDays: number | null;
}

/** Loads the current price list from the database and prices a quote request. Saves the estimate for conversion reporting. */
export async function priceQuote(input: QuoteInput, opts: { save?: boolean; now?: Date; companyId?: string } = {}): Promise<QuoteResult> {
  const now = opts.now ?? new Date();
  const settings = await getSettings();
  const route = await distanceFor(input, { lat: settings["contact.lat"], lng: settings["contact.lng"] });

  const empty = { lines: [], netCents: 0, vatCents: 0, totalCents: 0, transitDays: null };
  const routeInfo = { distanceKm: route?.distanceKm ?? null, durationMin: route?.durationMin ?? null, distanceSource: route?.source ?? null };

  if (!route && input.service !== "INTERNATIONAL_TRANSPORT") {
    return { quoteId: null, available: false, reason: "no_coordinates", ...empty, ...routeInfo };
  }

  const [rules, tariffs, holidays, discount, contract] = await Promise.all([
    db.pricingRule.findMany({ where: { isActive: true } }),
    input.service === "INTERNATIONAL_TRANSPORT" ? db.routeTariff.findMany({ where: { isActive: true } }) : Promise.resolve([]),
    db.holiday.findMany({ where: { date: { gte: new Date(now.getTime() - 864e5), lte: new Date(now.getTime() + 400 * 864e5) } } }),
    input.discountCode ? db.discountCode.findUnique({ where: { code: input.discountCode } }) : Promise.resolve(null),
    // Business customers get their contract prices
    opts.companyId ? db.contractPrice.findMany({ where: { companyId: opts.companyId } }) : Promise.resolve([]),
  ]);

  const result = calculatePrice(
    {
      service: input.service,
      vehicleType: input.vehicleType,
      distanceKm: route?.distanceKm ?? 0,
      isDrivable: input.isDrivable,
      options: input.options,
      pickupAt: input.isAsap ? null : (input.pickupAt ?? input.windowStart ?? null),
      international:
        input.service === "INTERNATIONAL_TRANSPORT"
          ? { fromCountry: input.pickup.country, fromCity: input.pickup.city, toCountry: input.dropoff?.country ?? "XK", toCity: input.dropoff?.city }
          : undefined,
    },
    {
      rules: rules.map(toRule),
      routeTariffs: tariffs as RouteTariff[],
      discount: discount as DiscountCode | null,
      contract: contract as ContractPrice[],
      holidays: holidays.map((h) => h.date.toISOString().slice(0, 10)),
      vatRateBp: settings["vat.rateBp"],
      now,
    },
  );

  if (!result.ok) return { quoteId: null, available: false, reason: result.reason, ...empty, ...routeInfo };

  let quoteId: string | null = null;
  if (opts.save !== false) {
    const saved = await db.quote.create({
      data: {
        input: JSON.parse(JSON.stringify({ ...input, distanceKm: route?.distanceKm ?? null })),
        breakdown: JSON.parse(JSON.stringify(result.lines)),
        subtotalCents: result.netCents,
        vatCents: result.vatCents,
        totalCents: result.totalCents,
        discountCodeId: discount?.id,
        validUntil: new Date(now.getTime() + 7 * 864e5),
      },
      select: { id: true },
    });
    quoteId = saved.id;
  }

  return {
    quoteId,
    available: true,
    lines: result.lines,
    netCents: result.netCents,
    vatCents: result.vatCents,
    totalCents: result.totalCents,
    transitDays: result.transitDays,
    ...routeInfo,
  };
}

async function distanceFor(input: QuoteInput, base: { lat: number; lng: number }): Promise<RouteEstimate | null> {
  const p = input.pickup;
  if (p.lat == null || p.lng == null) return null;
  // Roadside help is priced from our base to the customer.
  if (input.service === "ROADSIDE_ASSISTANCE" || !input.dropoff) return routeDistance(base, { lat: p.lat, lng: p.lng });
  const d = input.dropoff;
  if (d.lat == null || d.lng == null) return null;
  return routeDistance({ lat: p.lat, lng: p.lng }, { lat: d.lat, lng: d.lng });
}

function toRule(r: Awaited<ReturnType<typeof db.pricingRule.findMany>>[number]): PricingRule {
  return { ...r, conditions: (r.conditions as RuleConditions | null) ?? null };
}
