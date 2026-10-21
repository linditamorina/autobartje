import { describe, expect, it } from "vitest";
import { calculatePrice, localParts } from "./engine";
import { DEFAULT_PRICING_RULES as rules, DEFAULT_ROUTE_TARIFFS as routeTariffs } from "./defaults";
import type { PricingInput } from "./types";

// Wednesday 21 Oct 2026, 12:00 in Pejë (CEST, UTC+2)
const WEDNESDAY_NOON = new Date("2026-10-21T10:00:00Z");
const SATURDAY_NOON = new Date("2026-10-24T10:00:00Z");
const WEDNESDAY_23H = new Date("2026-10-21T21:00:00Z");

const domestic = (over: Partial<PricingInput> = {}): PricingInput => ({
  service: "DOMESTIC_TRANSPORT",
  vehicleType: "CAR",
  distanceKm: 40,
  isDrivable: true,
  options: {},
  pickupAt: WEDNESDAY_NOON,
  ...over,
});

function ok(r: ReturnType<typeof calculatePrice>) {
  if (!r.ok) throw new Error(`expected a price, got ${r.reason}`);
  return r;
}

describe("calculatePrice: domestic", () => {
  it("charges base fee + €/km + 18% VAT on a weekday", () => {
    const r = ok(calculatePrice(domestic(), { rules }));
    expect(r.lines.map((l) => [l.key, l.cents])).toEqual([
      ["base", 3000],
      ["per_km", 4000],
    ]);
    expect(r.netCents).toBe(7000);
    expect(r.vatCents).toBe(1260);
    expect(r.totalCents).toBe(8260);
  });

  it("uses the service-specific base fee for emergencies", () => {
    const r = ok(calculatePrice(domestic({ service: "EMERGENCY_TOWING", distanceKm: 10 }), { rules }));
    expect(r.lines[0]).toMatchObject({ key: "base_emergency", cents: 4000 });
  });

  it("switches to the long-distance km rate from 150 km", () => {
    const r = ok(calculatePrice(domestic({ distanceKm: 200 }), { rules }));
    expect(r.lines.find((l) => l.key === "per_km_long")?.cents).toBe(16000);
    expect(r.lines.some((l) => l.key === "per_km")).toBe(false);
  });

  it("adds the weekend surcharge as a percentage of the base only", () => {
    const r = ok(calculatePrice(domestic({ pickupAt: SATURDAY_NOON, isDrivable: false }), { rules }));
    // base 7000 → 15% = 1050; the fixed non-drivable surcharge is not part of the percentage base
    expect(r.lines.find((l) => l.key === "weekend")?.cents).toBe(1050);
    expect(r.lines.find((l) => l.key === "non_drivable")?.cents).toBe(2000);
    expect(r.netCents).toBe(7000 + 1050 + 2000);
  });

  it("applies the night surcharge between 22:00 and 06:00 local time", () => {
    const r = ok(calculatePrice(domestic({ pickupAt: WEDNESDAY_23H }), { rules }));
    expect(r.lines.find((l) => l.key === "night")?.cents).toBe(1750);
    const day = ok(calculatePrice(domestic(), { rules }));
    expect(day.lines.some((l) => l.key === "night")).toBe(false);
  });

  it("prices ASAP orders at the current time", () => {
    const r = ok(calculatePrice(domestic({ pickupAt: null }), { rules, now: WEDNESDAY_23H }));
    expect(r.lines.some((l) => l.key === "night")).toBe(true);
  });

  it("adds the holiday surcharge on configured local dates", () => {
    const r = ok(calculatePrice(domestic(), { rules, holidays: ["2026-10-21"] }));
    expect(r.lines.find((l) => l.key === "holiday")?.cents).toBe(2100);
  });

  it("adds options, vehicle-type surcharges, waiting time and tolls", () => {
    const r = ok(
      calculatePrice(
        domestic({ vehicleType: "LUXURY_LOW", options: { winch: true, enclosed: true, highway: true }, waitingHours: 1.5, tollsCents: 350 }),
        { rules },
      ),
    );
    const byKey = Object.fromEntries(r.lines.map((l) => [l.key, l.cents]));
    expect(byKey).toMatchObject({ enclosed: 2800, winch: 2500, highway: 1000, vehicle_luxury: 2500, waiting: 2250, tolls: 350 });
  });

  it("does not add vehicle surcharges for other vehicle types", () => {
    const r = ok(calculatePrice(domestic({ vehicleType: "CAR" }), { rules }));
    expect(r.lines.some((l) => l.key.startsWith("vehicle_"))).toBe(false);
  });

  it("tops up to the minimum price", () => {
    const r = ok(calculatePrice(domestic({ distanceKm: 2 }), { rules }));
    expect(r.netCents).toBe(3500);
    expect(r.lines.at(-1)).toMatchObject({ key: "minimum", cents: 300 });
  });

  it("ignores inactive and expired rules", () => {
    const custom = rules.map((r) =>
      r.key === "per_km" ? { ...r, isActive: false } : r.key === "base" ? { ...r, validTo: new Date("2026-01-01") } : r,
    );
    const r = calculatePrice(domestic(), { rules: custom });
    expect(r.ok).toBe(false);
  });

  it("never returns a negative total", () => {
    const r = ok(
      calculatePrice(domestic(), {
        rules,
        discount: { code: "BIG", percentBp: null, fixedCents: 999_999, maxUses: null, usedCount: 0, validFrom: null, validTo: null, isActive: true },
      }),
    );
    expect(r.netCents).toBe(0);
    expect(r.totalCents).toBe(0);
  });
});

describe("calculatePrice: discounts and contracts", () => {
  const code = { code: "WELCOME10", percentBp: 1000, fixedCents: null, maxUses: 10, usedCount: 0, validFrom: null, validTo: null, isActive: true };

  it("applies a percentage discount code after surcharges", () => {
    const r = ok(calculatePrice(domestic(), { rules, discount: code }));
    expect(r.lines.at(-1)).toMatchObject({ key: "discount", cents: -700 });
    expect(r.netCents).toBe(6300);
  });

  it("ignores a used-up discount code", () => {
    const r = ok(calculatePrice(domestic(), { rules, discount: { ...code, usedCount: 10 } }));
    expect(r.lines.some((l) => l.key === "discount")).toBe(false);
  });

  it("uses B2B contract prices instead of list prices", () => {
    const contract = [{ service: "DOMESTIC_TRANSPORT" as const, vehicleType: null, baseCents: 2000, perKmCents: 70, discountBp: null, validFrom: new Date("2026-01-01"), validTo: null }];
    const r = ok(calculatePrice(domestic(), { rules, contract }));
    expect(r.source).toBe("contract");
    expect(r.netCents).toBe(2000 + 2800);
  });

  it("applies a contract discount on list prices", () => {
    const contract = [{ service: "DOMESTIC_TRANSPORT" as const, vehicleType: null, baseCents: null, perKmCents: null, discountBp: 1000, validFrom: new Date("2026-01-01"), validTo: null }];
    const r = ok(calculatePrice(domestic(), { rules, contract }));
    expect(r.source).toBe("rules");
    expect(r.netCents).toBe(6300);
  });
});

describe("calculatePrice: international", () => {
  const intl = (over: Partial<PricingInput> = {}): PricingInput =>
    domestic({ service: "INTERNATIONAL_TRANSPORT", distanceKm: 1500, international: { fromCountry: "DE", fromCity: "Berlin", toCountry: "XK" }, ...over });

  it("uses the country-level route tariff", () => {
    const r = ok(calculatePrice(intl(), { rules, routeTariffs }));
    expect(r.source).toBe("route_tariff");
    expect(r.lines).toEqual([{ key: "route", label: "Route price", cents: 65000 }]);
    expect(r.transitDays).toBe(4);
  });

  it("prefers a city-specific tariff", () => {
    const r = ok(calculatePrice(intl({ international: { fromCountry: "DE", fromCity: "münchen", toCountry: "XK" } }), { rules, routeTariffs }));
    expect(r.lines[0].cents).toBe(60000);
  });

  it("prefers a vehicle-specific tariff", () => {
    const r = ok(calculatePrice(intl({ vehicleType: "VAN" }), { rules, routeTariffs }));
    expect(r.lines.find((l) => l.key === "route")?.cents).toBe(80000);
  });

  it("uses the enclosed price and skips time-of-day surcharges", () => {
    const r = ok(calculatePrice(intl({ options: { enclosed: true }, pickupAt: SATURDAY_NOON }), { rules, routeTariffs }));
    expect(r.lines.map((l) => l.key)).toEqual(["route"]);
    expect(r.lines[0].cents).toBe(95000);
  });

  it("adds customs only when the route does not include it", () => {
    const de = ok(calculatePrice(intl({ options: { customs: true } }), { rules, routeTariffs }));
    expect(de.lines.some((l) => l.key === "customs")).toBe(true);
    const ch = ok(calculatePrice(intl({ options: { customs: true }, international: { fromCountry: "CH", toCountry: "XK" } }), { rules, routeTariffs }));
    expect(ch.lines.some((l) => l.key === "customs")).toBe(false);
  });

  it("reports a missing route so the operator can quote manually", () => {
    const r = calculatePrice(intl({ international: { fromCountry: "FR", toCountry: "XK" } }), { rules, routeTariffs });
    expect(r).toEqual({ ok: false, reason: "no_route_tariff" });
  });
});

describe("localParts", () => {
  it("handles the switch from summer to winter time", () => {
    // 25 Oct 2026 is the last Sunday of October: 03:00 CEST becomes 02:00 CET
    expect(localParts(new Date("2026-10-25T00:30:00Z"), "Europe/Belgrade").hour).toBe(2);
    expect(localParts(new Date("2026-10-25T01:30:00Z"), "Europe/Belgrade").hour).toBe(2);
    expect(localParts(new Date("2026-10-25T01:30:00Z"), "Europe/Belgrade").weekday).toBe(0);
  });
});
