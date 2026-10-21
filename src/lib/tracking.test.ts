import { describe, expect, it } from "vitest";
import { trackUrl, trackingSteps } from "./tracking";

const states = (s: ReturnType<typeof trackingSteps>) => s.map((x) => `${x.key}:${x.state}`);

describe("trackingSteps", () => {
  it("marks earlier steps done and the current one", () => {
    expect(states(trackingSteps("DRIVER_EN_ROUTE", "EMERGENCY_TOWING"))).toEqual([
      "RECEIVED:done", "CONFIRMED:done", "DRIVER_EN_ROUTE:current", "PICKED_UP:todo", "IN_TRANSIT:todo", "DELIVERED:todo",
    ]);
  });
  it("treats a completed order as delivered and finished", () => {
    expect(trackingSteps("COMPLETED", "DOMESTIC_TRANSPORT").every((s) => s.state === "done")).toBe(true);
  });
  it("leaves out the transport leg for roadside help", () => {
    expect(trackingSteps("PICKED_UP", "ROADSIDE_ASSISTANCE").map((s) => s.key)).not.toContain("IN_TRANSIT");
  });
  it("has no current step when cancelled", () => {
    expect(trackingSteps("CANCELLED", "DOMESTIC_TRANSPORT").some((s) => s.state !== "todo")).toBe(false);
  });
});

describe("trackUrl", () => {
  it("uses the locale prefix only for non-default languages", () => {
    expect(trackUrl("abc", "sq")).toMatch(/\/track\/abc$/);
    expect(trackUrl("abc", "sq")).not.toMatch(/\/sq\//);
    expect(trackUrl("abc", "de")).toMatch(/\/de\/track\/abc$/);
    expect(trackUrl("abc", "sr")).not.toMatch(/\/sr\//);
  });
});
