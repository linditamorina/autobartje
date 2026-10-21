import { describe, expect, it } from "vitest";
import { startOfBusinessDay } from "./time";

describe("startOfBusinessDay", () => {
  it("uses Kosovo midnight in summer (UTC+2)", () => {
    expect(startOfBusinessDay(new Date("2026-07-10T21:30:00Z")).toISOString()).toBe("2026-07-09T22:00:00.000Z");
    expect(startOfBusinessDay(new Date("2026-07-10T22:30:00Z")).toISOString()).toBe("2026-07-10T22:00:00.000Z");
  });
  it("uses Kosovo midnight in winter (UTC+1)", () => {
    expect(startOfBusinessDay(new Date("2026-12-01T10:00:00Z")).toISOString()).toBe("2026-11-30T23:00:00.000Z");
  });
});
