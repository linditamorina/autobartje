import { describe, expect, it } from "vitest";
import { onlineDue } from "./due";

const base = { status: "CONFIRMED", finalCents: 9000, payments: [], invoice: null };

describe("onlineDue", () => {
  it("is the final price once the order is confirmed", () => {
    expect(onlineDue(base)).toEqual({ amountCents: 9000, invoiceId: null });
  });
  it("is nothing before confirmation or without a final price", () => {
    expect(onlineDue({ ...base, status: "RECEIVED" })).toBeNull();
    expect(onlineDue({ ...base, finalCents: null })).toBeNull();
    expect(onlineDue({ ...base, status: "CANCELLED" })).toBeNull();
  });
  it("subtracts what was already paid, and ignores failed payments", () => {
    const payments = [{ amountCents: 4000, status: "SUCCEEDED" }, { amountCents: 5000, status: "FAILED" }];
    expect(onlineDue({ ...base, payments })?.amountCents).toBe(5000);
    expect(onlineDue({ ...base, payments: [{ amountCents: 9000, status: "SUCCEEDED" }] })).toBeNull();
  });
  it("follows an issued invoice instead of the order price", () => {
    const invoice = { id: "inv1", status: "PARTIALLY_PAID", totalCents: 10000, paidCents: 2500 };
    expect(onlineDue({ ...base, status: "COMPLETED", invoice })).toEqual({ amountCents: 7500, invoiceId: "inv1" });
    expect(onlineDue({ ...base, invoice: { ...invoice, status: "PAID", paidCents: 10000 } })).toBeNull();
    expect(onlineDue({ ...base, invoice: { ...invoice, status: "VOID" } })).toBeNull();
  });
  it("uses the order price while the invoice is still a draft", () => {
    expect(onlineDue({ ...base, invoice: { id: "d", status: "DRAFT", totalCents: 1, paidCents: 0 } })?.amountCents).toBe(9000);
  });
  it("skips amounts under Stripe's minimum", () => {
    expect(onlineDue({ ...base, payments: [{ amountCents: 8960, status: "SUCCEEDED" }] })).toBeNull();
  });
});
