import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ db: {} }));

const { monthRange } = await import("./monthly");

describe("monthRange", () => {
  it("covers the calendar month in Kosovo time", () => {
    const { from, to } = monthRange("2026-03");
    expect(from.toISOString()).toBe("2026-02-28T23:00:00.000Z");
    // Summer time starts on 29 March
    expect(to.toISOString()).toBe("2026-03-31T22:00:00.000Z");
  });
  it("rolls over the year", () => {
    expect(monthRange("2026-12").to.toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });
  it("rejects anything else", () => {
    expect(() => monthRange("2026-13")).toThrow();
    expect(() => monthRange("26-01")).toThrow();
  });
});
