import { describe, expect, it } from "vitest";
import { businessDate, businessDayRange, fromBusinessLocal, startOfBusinessDay, toBusinessLocal } from "./time";

describe("startOfBusinessDay", () => {
  it("uses Kosovo midnight in summer (UTC+2)", () => {
    expect(startOfBusinessDay(new Date("2026-07-10T21:30:00Z")).toISOString()).toBe("2026-07-09T22:00:00.000Z");
    expect(startOfBusinessDay(new Date("2026-07-10T22:30:00Z")).toISOString()).toBe("2026-07-10T22:00:00.000Z");
  });
  it("uses Kosovo midnight in winter (UTC+1)", () => {
    expect(startOfBusinessDay(new Date("2026-12-01T10:00:00Z")).toISOString()).toBe("2026-11-30T23:00:00.000Z");
  });
});

describe("businessDayRange", () => {
  it("spans 25 hours on the autumn clock change", () => {
    const { start, end } = businessDayRange("2026-10-25");
    expect(start.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });
  it("round-trips with businessDate", () => {
    expect(businessDate(new Date("2026-07-10T22:30:00Z"))).toBe("2026-07-11");
  });
});

describe("business local time", () => {
  it("converts both ways in summer and winter", () => {
    expect(fromBusinessLocal("2026-07-10T08:30")?.toISOString()).toBe("2026-07-10T06:30:00.000Z");
    expect(fromBusinessLocal("2026-12-10T08:30")?.toISOString()).toBe("2026-12-10T07:30:00.000Z");
    expect(toBusinessLocal(new Date("2026-12-10T07:30:00Z"))).toBe("2026-12-10T08:30");
    expect(fromBusinessLocal("10/12/2026")).toBeNull();
  });
});
