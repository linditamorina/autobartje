import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ db: {} }));

const { toCsv, toXlsx } = await import("./export");

const rows = [
  { number: "AB-2026-00001", kind: "Faturë", issueDate: "2026-11-02", buyer: 'Auto "Import"; Pejë', buyerNui: "810000001", order: "P-2026-00042", net: 50, vat: 9, total: 59, paid: 59, status: "PAID" },
  { number: "AB-2026-00002", kind: "Notë krediti", issueDate: "2026-11-03", buyer: "=HYPERLINK(\"x\")", buyerNui: "", order: "", net: -50, vat: -9, total: -59, paid: 0, status: "ISSUED" },
];

describe("invoice export", () => {
  it("writes Excel-friendly CSV with decimal commas, quoting and formula protection", () => {
    const csv = toCsv(rows);
    expect(csv.startsWith("﻿Nr. fature;Lloji;Data")).toBe(true);
    expect(csv).toContain('AB-2026-00001;Faturë;2026-11-02;"Auto ""Import""; Pejë";810000001;P-2026-00042;50,00;9,00;59,00;59,00;PAID');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(";-50,00;-9,00;-59,00;");
  });

  it("writes an xlsx file", async () => {
    const bytes = await toXlsx(rows);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });
});
