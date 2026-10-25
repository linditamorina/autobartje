/** Stripe does not take card payments under €0.50. */
export const MIN_ONLINE_CENTS = 50;

const PAYABLE_ORDER = ["CONFIRMED", "DRIVER_EN_ROUTE", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];
const OPEN_INVOICE = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"];

export type DueInput = {
  status: string;
  finalCents: number | null;
  payments: { amountCents: number; status: string }[];
  invoice: { id: string; status: string; totalCents: number; paidCents: number } | null;
};

/**
 * What the customer can pay online now. An issued invoice decides the amount;
 * before that, the confirmed final price less what was already paid.
 */
export function onlineDue(o: DueInput): { amountCents: number; invoiceId: string | null } | null {
  let due: { amountCents: number; invoiceId: string | null } | null = null;
  if (o.invoice && o.invoice.status !== "DRAFT") {
    if (OPEN_INVOICE.includes(o.invoice.status)) due = { amountCents: o.invoice.totalCents - o.invoice.paidCents, invoiceId: o.invoice.id };
  } else if (PAYABLE_ORDER.includes(o.status) && o.finalCents != null) {
    const paid = o.payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amountCents, 0);
    due = { amountCents: o.finalCents - paid, invoiceId: null };
  }
  return due && due.amountCents >= MIN_ONLINE_CENTS ? due : null;
}
