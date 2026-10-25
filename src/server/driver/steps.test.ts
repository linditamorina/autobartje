import { describe, expect, it } from "vitest";
import { inspectionComplete, inspectionOpen, missingForInspection, nextDriverStep } from "./steps";

const photos = (...angles: string[]) => angles.map((angle) => ({ angle }));

describe("nextDriverStep", () => {
  it("walks a tow from start to delivery, asking for inspections", () => {
    expect(nextDriverStep("CONFIRMED", "EMERGENCY_TOWING")).toEqual({ to: "DRIVER_EN_ROUTE", action: "start" });
    expect(nextDriverStep("DRIVER_EN_ROUTE", "EMERGENCY_TOWING")).toEqual({ to: "PICKED_UP", action: "picked_up", needs: "PICKUP" });
    expect(nextDriverStep("PICKED_UP", "DOMESTIC_TRANSPORT")).toEqual({ to: "IN_TRANSIT", action: "on_the_way" });
    expect(nextDriverStep("IN_TRANSIT", "DOMESTIC_TRANSPORT")).toEqual({ to: "DELIVERED", action: "delivered", needs: "DELIVERY" });
    expect(nextDriverStep("DELIVERED", "DOMESTIC_TRANSPORT")).toBeNull();
  });

  it("finishes roadside help on the spot without inspections", () => {
    expect(nextDriverStep("DRIVER_EN_ROUTE", "ROADSIDE_ASSISTANCE")).toEqual({ to: "PICKED_UP", action: "arrived" });
    expect(nextDriverStep("PICKED_UP", "ROADSIDE_ASSISTANCE")).toEqual({ to: "DELIVERED", action: "done" });
  });

  it("offers nothing before confirmation or after cancellation", () => {
    expect(nextDriverStep("RECEIVED", "EMERGENCY_TOWING")).toBeNull();
    expect(nextDriverStep("CANCELLED", "EMERGENCY_TOWING")).toBeNull();
  });
});

describe("inspections", () => {
  it("needs all four sides at pickup", () => {
    expect(missingForInspection(undefined, "PICKUP")).toEqual({ angles: ["FRONT", "REAR", "LEFT", "RIGHT"], signature: false });
    expect(inspectionComplete({ photos: photos("FRONT", "REAR", "LEFT"), signedAt: null }, "PICKUP")).toBe(false);
    expect(inspectionComplete({ photos: photos("FRONT", "REAR", "LEFT", "RIGHT", "DAMAGE"), signedAt: null }, "PICKUP")).toBe(true);
  });

  it("needs the customer's signature at delivery", () => {
    const all = photos("FRONT", "REAR", "LEFT", "RIGHT");
    expect(inspectionComplete({ photos: all, signedAt: null }, "DELIVERY")).toBe(false);
    expect(inspectionComplete({ photos: all, signedAt: new Date() }, "DELIVERY")).toBe(true);
  });

  it("opens each inspection only around its leg", () => {
    expect(inspectionOpen("CONFIRMED", "PICKUP")).toBe(false);
    expect(inspectionOpen("DRIVER_EN_ROUTE", "PICKUP")).toBe(true);
    expect(inspectionOpen("DRIVER_EN_ROUTE", "DELIVERY")).toBe(false);
    expect(inspectionOpen("IN_TRANSIT", "DELIVERY")).toBe(true);
    expect(inspectionOpen("DELIVERED", "DELIVERY")).toBe(false);
  });
});
