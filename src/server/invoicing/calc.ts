import { applyBp, VAT_RATE_BP } from "@/lib/money";

export interface LineInput {
  description: string;
  quantity: number; // up to 2 decimals
  unit?: string;
  unitPriceCents: number; // net
  vatRateBp?: number;
}

export interface CalculatedLine extends Required<LineInput> {
  position: number;
  netCents: number;
  vatCents: number;
  grossCents: number;
}

export interface InvoiceTotals {
  lines: CalculatedLine[];
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  /** VAT summary per rate, as printed on the invoice. */
  vatBreakdown: { rateBp: number; netCents: number; vatCents: number }[];
}

/**
 * VAT is calculated per line and rounded per line, so the printed lines always
 * add up to the printed totals.
 */
export function calculateInvoice(inputs: LineInput[]): InvoiceTotals {
  const lines = inputs.map((l, i): CalculatedLine => {
    if (!Number.isFinite(l.quantity) || l.quantity <= 0) throw new Error(`Line ${i + 1}: quantity must be positive`);
    if (!Number.isInteger(l.unitPriceCents)) throw new Error(`Line ${i + 1}: unit price must be whole cents`);
    const vatRateBp = l.vatRateBp ?? VAT_RATE_BP;
    const netCents = Math.round(round2(l.quantity) * l.unitPriceCents);
    const vatCents = applyBp(netCents, vatRateBp);
    return {
      position: i + 1,
      description: l.description.trim(),
      quantity: round2(l.quantity),
      unit: l.unit ?? "copë",
      unitPriceCents: l.unitPriceCents,
      vatRateBp,
      netCents,
      vatCents,
      grossCents: netCents + vatCents,
    };
  });

  const byRate = new Map<number, { rateBp: number; netCents: number; vatCents: number }>();
  for (const l of lines) {
    const row = byRate.get(l.vatRateBp) ?? { rateBp: l.vatRateBp, netCents: 0, vatCents: 0 };
    row.netCents += l.netCents;
    row.vatCents += l.vatCents;
    byRate.set(l.vatRateBp, row);
  }

  const subtotalCents = lines.reduce((a, l) => a + l.netCents, 0);
  const vatCents = lines.reduce((a, l) => a + l.vatCents, 0);
  return {
    lines,
    subtotalCents,
    vatCents,
    totalCents: subtotalCents + vatCents,
    vatBreakdown: [...byRate.values()].sort((a, b) => b.rateBp - a.rateBp),
  };
}

/** Splits a VAT-inclusive price (what private customers see) into net + VAT. */
export function netFromGross(grossCents: number, rateBp = VAT_RATE_BP): number {
  return Math.round((grossCents * 10_000) / (10_000 + rateBp));
}

export function formatDocumentNumber(series: string, year: number, sequence: number, pad = 5): string {
  return `${series}-${year}-${String(sequence).padStart(pad, "0")}`;
}

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";

/** Status after payments, given the invoice is issued. */
export function paymentStatus(totalCents: number, paidCents: number, dueDate: Date | null, now = new Date()): InvoiceStatus {
  if (paidCents >= totalCents) return "PAID";
  if (dueDate && dueDate < now) return "OVERDUE";
  if (paidCents > 0) return "PARTIALLY_PAID";
  return "ISSUED";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
