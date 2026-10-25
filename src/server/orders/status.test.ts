import { describe, expect, it } from "vitest";
import { allowedTransitions, canTransition, isOpen } from "./status";

describe("order status machine", () => {
  it("follows the customer timeline forward", () => {
    expect(canTransition("RECEIVED", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "DRIVER_EN_ROUTE")).toBe(true);
    expect(canTransition("DRIVER_EN_ROUTE", "PICKED_UP")).toBe(true);
    expect(canTransition("PICKED_UP", "IN_TRANSIT")).toBe(true);
    expect(canTransition("IN_TRANSIT", "DELIVERED")).toBe(true);
    expect(canTransition("DELIVERED", "COMPLETED")).toBe(true);
  });

  it("does not skip confirmation or go back after pickup", () => {
    expect(canTransition("RECEIVED", "DELIVERED")).toBe(false);
    expect(canTransition("PICKED_UP", "CONFIRMED")).toBe(false);
    expect(canTransition("PICKED_UP", "CANCELLED")).toBe(false);
  });

  it("allows cancelling before pickup and reopening a cancelled order", () => {
    expect(allowedTransitions("CONFIRMED")).toContain("CANCELLED");
    expect(canTransition("CANCELLED", "RECEIVED")).toBe(true);
  });

  it("treats completed, delivered and cancelled orders as closed", () => {
    expect(isOpen("RECEIVED")).toBe(true);
    expect(isOpen("IN_TRANSIT")).toBe(true);
    expect(isOpen("DELIVERED")).toBe(false);
    expect(isOpen("CANCELLED")).toBe(false);
  });
});
