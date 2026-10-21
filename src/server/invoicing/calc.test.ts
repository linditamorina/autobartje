import { describe, expect, it } from "vitest";
import { calculateInvoice, formatDocumentNumber, netFromGross, paymentStatus } from "./calc";

describe("calculateInvoice", () => {
  it("calculates 18% VAT per line and totals", () => {
    const r = calculateInvoice([
      { description: "Towing Pejë → Prishtinë", quantity: 1, unitPriceCents: 7000 },
      { description: "Waiting time", quantity: 1.5, unit: "orë", unitPriceCents: 1500 },
    ]);
    expect(r.lines.map((l) => [l.netCents, l.vatCents, l.grossCents])).toEqual([
      [7000, 1260, 8260],
      [2250, 405, 2655],
    ]);
    expect(r).toMatchObject({ subtotalCents: 9250, vatCents: 1665, totalCents: 10915 });
    expect(r.vatBreakdown).toEqual([{ rateBp: 1800, netCents: 9250, vatCents: 1665 }]);
  });

  it("rounds VAT per line so lines always add up to the totals", () => {
    const r = calculateInvoice([
      { description: "A", quantity: 1, unitPriceCents: 333 },
      { description: "B", quantity: 1, unitPriceCents: 333 },
      { description: "C", quantity: 1, unitPriceCents: 333 },
    ]);
    expect(r.lines.map((l) => l.vatCents)).toEqual([60, 60, 60]);
    expect(r.vatCents).toBe(180);
    expect(r.totalCents).toBe(r.lines.reduce((a, l) => a + l.grossCents, 0));
  });

  it("groups VAT by rate, e.g. for exempt export lines", () => {
    const r = calculateInvoice([
      { description: "Transport", quantity: 1, unitPriceCents: 10000 },
      { description: "Customs fee (passed through)", quantity: 1, unitPriceCents: 5000, vatRateBp: 0 },
    ]);
    expect(r.vatBreakdown).toEqual([
      { rateBp: 1800, netCents: 10000, vatCents: 1800 },
      { rateBp: 0, netCents: 5000, vatCents: 0 },
    ]);
    expect(r.totalCents).toBe(16800);
  });

  it("supports credit-note lines with negative prices", () => {
    const r = calculateInvoice([{ description: "Credit", quantity: 1, unitPriceCents: -7000 }]);
    expect(r).toMatchObject({ subtotalCents: -7000, vatCents: -1260, totalCents: -8260 });
  });

  it("rejects invalid quantities and fractional cents", () => {
    expect(() => calculateInvoice([{ description: "X", quantity: 0, unitPriceCents: 100 }])).toThrow(/quantity/);
    expect(() => calculateInvoice([{ description: "X", quantity: 1, unitPriceCents: 10.5 }])).toThrow(/whole cents/);
  });
});

describe("helpers", () => {
  it("formats sequential document numbers", () => {
    expect(formatDocumentNumber("AB", 2026, 42)).toBe("AB-2026-00042");
    expect(formatDocumentNumber("AB", 2026, 123456)).toBe("AB-2026-123456");
  });

  it("splits a gross price into net", () => {
    expect(netFromGross(8260)).toBe(7000);
    expect(netFromGross(10000)).toBe(8475);
  });

  it("derives payment status", () => {
    const due = new Date("2026-11-01");
    const before = new Date("2026-10-21");
    const after = new Date("2026-11-05");
    expect(paymentStatus(8260, 0, due, before)).toBe("ISSUED");
    expect(paymentStatus(8260, 1000, due, before)).toBe("PARTIALLY_PAID");
    expect(paymentStatus(8260, 1000, due, after)).toBe("OVERDUE");
    expect(paymentStatus(8260, 8260, due, after)).toBe("PAID");
  });
});
