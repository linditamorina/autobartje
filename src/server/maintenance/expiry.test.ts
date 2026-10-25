import { describe, expect, it } from "vitest";
import { remindersDue } from "./expiry";

const today = new Date("2026-11-01T23:00:00Z"); // 2 Nov, 00:00 Kosovo time
const at = (iso: string) => new Date(iso);

describe("remindersDue", () => {
  it("reminds 30, 7 and 1 days before and on the day, nothing in between", () => {
    const items = [
      { who: "03-123-AB", kind: "insurance", date: at("2026-12-02T22:59:00Z") }, // 2 Dec 23:59 → 30 days
      { who: "03-123-AB", kind: "inspection", date: at("2026-11-09T22:59:00Z") }, // 9 Nov → 7 days
      { who: "Arben K.", kind: "license", date: at("2026-11-02T22:59:00Z") }, // today
      { who: "03-456-AB", kind: "registration", date: at("2026-11-12T22:59:00Z") }, // 10 days: no
    ];
    expect(remindersDue(items, today).map((i) => `${i.kind}:${i.daysLeft}`)).toEqual(["license:0", "inspection:7", "insurance:30"]);
  });
});
