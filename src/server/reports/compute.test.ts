import { describe, expect, it } from "vitest";
import { arrivalMinutes, driverStats, groupBy, heatmap, monthlyInvoiced, paymentsByMethod, periodFrom, summary, type ReportOrder } from "./compute";

const at = (iso: string) => new Date(iso);
function order(p: Partial<ReportOrder> = {}): ReportOrder {
  return {
    createdAt: at("2026-10-05T10:00:00Z"),
    status: "DELIVERED",
    service: "DOMESTIC_TRANSPORT",
    channel: "WEB_BOOKING",
    leadSource: null,
    priority: "NORMAL",
    isAsap: false,
    companyId: null,
    valueCents: 10_000,
    distanceKm: 20,
    events: [],
    driver: null,
    ...p,
  };
}
const urgent = (minutes: number, p: Partial<ReportOrder> = {}) =>
  order({
    service: "EMERGENCY_TOWING",
    isAsap: true,
    events: [
      { to: "CONFIRMED", at: at("2026-10-05T10:04:00Z") },
      { to: "PICKED_UP", at: new Date(at("2026-10-05T10:00:00Z").getTime() + minutes * 60_000) },
    ],
    ...p,
  });

describe("periodFrom", () => {
  const now = at("2026-10-21T20:00:00Z");
  it("defaults to this month in business time", () => {
    const p = periodFrom({}, now);
    expect([p.key, p.fromDate, p.toDate]).toEqual(["month", "2026-10-01", "2026-10-21"]);
    expect(p.from.toISOString()).toBe("2026-09-30T22:00:00.000Z"); // midnight in Kosovo (CEST)
  });
  it("handles last month across a year boundary", () => {
    const p = periodFrom({ period: "lastMonth" }, at("2026-01-10T10:00:00Z"));
    expect([p.fromDate, p.toDate]).toEqual(["2025-12-01", "2025-12-31"]);
  });
  it("takes a valid custom range and falls back on a bad one", () => {
    expect(periodFrom({ period: "custom", from: "2026-03-01", to: "2026-03-31" }, now).fromDate).toBe("2026-03-01");
    const bad = periodFrom({ period: "custom", from: "2026-04-01", to: "2026-03-01" }, now);
    expect(bad.key).toBe("month");
  });
  it("has 30 day and year presets", () => {
    expect(periodFrom({ period: "30d" }, now).fromDate).toBe("2026-09-22");
    expect(periodFrom({ period: "year" }, now).fromDate).toBe("2026-01-01");
  });
});

describe("arrivalMinutes", () => {
  it("counts urgent call-outs only, from booking to arrival", () => {
    expect(arrivalMinutes(urgent(27))).toBe(27);
    expect(arrivalMinutes(order({ events: [{ to: "PICKED_UP", at: at("2026-10-05T10:30:00Z") }] }))).toBeNull();
    expect(arrivalMinutes(urgent(3 * 24 * 60))).toBeNull();
  });
});

describe("summary", () => {
  it("adds up orders, value, invoices, conversion and response times", () => {
    const s = summary(
      [urgent(20), urgent(30), urgent(60), order({ status: "CANCELLED" }), order({ status: "DRAFT" }), order({ companyId: "c1", valueCents: null })],
      [{ issueDate: at("2026-10-06T10:00:00Z"), subtotalCents: 8475, totalCents: 10_000 }, { issueDate: at("2026-10-07T10:00:00Z"), subtotalCents: -847, totalCents: -1000 }],
      [{ converted: true }, { converted: false }, { converted: false }, { converted: true }],
    );
    expect(s.orders).toBe(5); // drafts are not orders
    expect(s.done).toBe(4);
    expect(s.cancelled).toBe(1);
    expect(s.cancelRate).toBeCloseTo(0.2);
    expect(s.b2b).toBe(1);
    expect(s.doneValueCents).toBe(30_000);
    expect(s.avgOrderCents).toBe(10_000); // the unpriced order is left out of the average
    expect(s.invoicedGrossCents).toBe(9000); // credit note subtracts
    expect(s.quoteConversion).toBe(0.5);
    expect(s.arrival).toEqual({ count: 3, median: 30, p90: 60 });
    expect(s.confirmMedian).toBe(4);
  });
  it("returns nulls rather than zeros when there is nothing to measure", () => {
    const s = summary([], [], []);
    expect([s.cancelRate, s.avgOrderCents, s.quoteConversion, s.arrival.median]).toEqual([null, null, null, null]);
  });
});

describe("groupBy / driverStats / payments", () => {
  it("groups by key, biggest first", () => {
    const rows = groupBy([order(), order({ service: "EMERGENCY_TOWING" }), order({ service: "EMERGENCY_TOWING", status: "CANCELLED" })], (o) => o.service);
    expect(rows).toEqual([
      { key: "EMERGENCY_TOWING", orders: 2, done: 1, valueCents: 10_000 },
      { key: "DOMESTIC_TRANSPORT", orders: 1, done: 1, valueCents: 10_000 },
    ]);
  });
  it("sums finished jobs per driver", () => {
    const arben = { id: "d1", name: "Arben" };
    const rows = driverStats([urgent(20, { driver: arben }), urgent(40, { driver: arben, distanceKm: 5.6 }), order({ driver: arben, status: "CONFIRMED" }), order()]);
    expect(rows).toEqual([{ id: "d1", name: "Arben", jobs: 2, km: 26, valueCents: 20_000, arrivalMedian: 30 }]);
  });
  it("totals payments per method", () => {
    expect(paymentsByMethod([{ method: "CASH", amountCents: 500 }, { method: "CARD", amountCents: 9000 }, { method: "CASH", amountCents: 700 }])).toEqual([
      { method: "CARD", count: 1, cents: 9000 },
      { method: "CASH", count: 2, cents: 1200 },
    ]);
  });
});

describe("heatmap / monthlyInvoiced", () => {
  it("buckets by weekday and hour in business time", () => {
    // Monday 5 Oct 2026, 23:30 UTC = Tuesday 01:30 in Kosovo
    const g = heatmap([order({ createdAt: at("2026-10-05T23:30:00Z") })]);
    expect(g[1][1]).toBe(1);
    expect(g.flat().reduce((a, b) => a + b, 0)).toBe(1);
  });
  it("gives 12 months ending with the current one", () => {
    const rows = monthlyInvoiced([{ issueDate: at("2026-09-30T22:30:00Z"), subtotalCents: 100, totalCents: 118 }], at("2026-10-21T10:00:00Z"));
    expect(rows).toHaveLength(12);
    expect(rows[0].month).toBe("2025-11");
    expect(rows[11]).toEqual({ month: "2026-10", netCents: 100, grossCents: 118 }); // 00:30 on 1 Oct in Kosovo
  });
});
