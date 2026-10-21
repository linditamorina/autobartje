import { describe, expect, it } from "vitest";
import { can, SYSTEM_ROLES } from "./permissions";

const role = (key: string) => SYSTEM_ROLES.find((r) => r.key === key)!.permissions;

describe("permissions", () => {
  it("gives the owner everything", () => {
    expect(can(role("OWNER"), "settings.manage")).toBe(true);
  });

  it("lets dispatchers assign but not issue invoices or change settings", () => {
    expect(can(role("DISPATCHER"), "orders.assign")).toBe(true);
    expect(can(role("DISPATCHER"), "invoices.issue")).toBe(false);
    expect(can(role("DISPATCHER"), "settings.manage")).toBe(false);
  });

  it("lets accountants issue invoices but not assign drivers", () => {
    expect(can(role("ACCOUNTANT"), "invoices.issue")).toBe(true);
    expect(can(role("ACCOUNTANT"), "orders.assign")).toBe(false);
  });

  it("requires 2FA for owner and admin only", () => {
    expect(SYSTEM_ROLES.filter((r) => r.requires2fa).map((r) => r.key)).toEqual(["OWNER", "ADMIN"]);
  });
});
