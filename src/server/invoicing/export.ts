import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/server/db";
import { BUSINESS_TZ } from "@/lib/time";
import type { Buyer } from "./manage";

export interface ExportRow {
  number: string;
  kind: string;
  issueDate: string;
  buyer: string;
  buyerNui: string;
  order: string;
  net: number;
  vat: number;
  total: number;
  paid: number;
  status: string;
}

const HEADERS: [keyof ExportRow, string][] = [
  ["number", "Nr. fature"],
  ["kind", "Lloji"],
  ["issueDate", "Data"],
  ["buyer", "Blerësi"],
  ["buyerNui", "NUI blerësi"],
  ["order", "Porosia"],
  ["net", "Pa TVSH (EUR)"],
  ["vat", "TVSH (EUR)"],
  ["total", "Gjithsej (EUR)"],
  ["paid", "Paguar (EUR)"],
  ["status", "Statusi"],
];

/** Issued invoices and credit notes in [from, to), for the accountant / tax declaration. */
export async function exportRows(from: Date, to: Date): Promise<ExportRow[]> {
  const rows = await db.invoice.findMany({
    where: { number: { not: null }, issueDate: { gte: from, lt: to } },
    orderBy: [{ year: "asc" }, { sequence: "asc" }],
    include: { order: { select: { number: true } } },
  });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return rows.map((r) => {
    const b = r.buyerSnapshot as Buyer;
    return {
      number: r.number!,
      kind: r.kind === "CREDIT_NOTE" ? "Notë krediti" : "Faturë",
      issueDate: day.format(r.issueDate!),
      buyer: b?.name ?? "",
      buyerNui: b?.nui ?? "",
      order: r.order?.number ?? "",
      net: r.subtotalCents / 100,
      vat: r.vatCents / 100,
      total: r.totalCents / 100,
      paid: r.paidCents / 100,
      status: r.status,
    };
  });
}

/** CSV for Excel in Kosovo/Germany: semicolon separated, decimal comma, UTF-8 with BOM. */
export function toCsv(rows: ExportRow[]): string {
  const cell = (v: string | number) => {
    const s = typeof v === "number" ? v.toFixed(2).replace(".", ",") : v;
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // A leading =, +, - or @ would run as a formula in Excel: prefix text cells that start that way.
  const safe = (v: string | number) => (typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v);
  return "﻿" + [HEADERS.map(([, h]) => h).join(";"), ...rows.map((r) => HEADERS.map(([k]) => cell(safe(r[k]))).join(";"))].join("\r\n") + "\r\n";
}

export async function toXlsx(rows: ExportRow[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Faturat");
  ws.columns = HEADERS.map(([key, header]) => ({ key, header, width: key === "buyer" ? 32 : 16 }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r);
  for (const k of ["net", "vat", "total", "paid"]) ws.getColumn(k).numFmt = "#,##0.00";
  const sum = (k: keyof ExportRow) => rows.reduce((a, r) => a + (r[k] as number), 0);
  const total = ws.addRow({ number: "Gjithsej", net: sum("net"), vat: sum("vat"), total: sum("total"), paid: sum("paid") });
  total.font = { bold: true };
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
