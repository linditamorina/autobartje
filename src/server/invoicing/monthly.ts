import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { getSettings } from "@/server/settings";
import { fromBusinessLocal } from "@/lib/time";
import { calculateInvoice } from "./calc";
import { InvoiceError, orderLineDescription, toLineRow, type Buyer } from "./manage";

/** Start (inclusive) and end (exclusive) of a calendar month in Kosovo time. */
export function monthRange(month: string): { from: Date; to: Date } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new InvoiceError("not_found");
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: fromBusinessLocal(`${month}-01T00:00`)!, to: fromBusinessLocal(`${next}-01T00:00`)! };
}

/** Orders of a company delivered in the month that are on no invoice yet. */
export async function uninvoicedOrders(companyId: string, month: string) {
  const { from, to } = monthRange(month);
  const onMonthly = await db.invoiceLine.findMany({ where: { orderId: { not: null }, invoice: { companyId, kind: "INVOICE", status: { not: "VOID" } } }, select: { orderId: true } });
  return db.order.findMany({
    where: {
      companyId,
      status: { in: ["DELIVERED", "COMPLETED"] },
      deliveredAt: { gte: from, lt: to },
      invoices: { none: { kind: "INVOICE", status: { not: "VOID" } } },
      // ... and not a line on another monthly invoice
      id: { notIn: onMonthly.map((l) => l.orderId!) },
    },
    include: { vehicle: true },
    orderBy: { deliveredAt: "asc" },
  });
}

/** One draft invoice for all of a company's uninvoiced orders delivered in the month, one line each. */
export async function createMonthlyInvoice(companyId: string, month: string, actorId: string) {
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) throw new InvoiceError("not_found");
  const orders = await uninvoicedOrders(companyId, month);
  if (!orders.length) throw new InvoiceError("no_lines");
  if (orders.some((o) => (o.finalCents ?? o.estimatedCents) == null)) throw new InvoiceError("no_price");
  const s = await getSettings();
  const totals = calculateInvoice(
    orders.map((o) => ({ description: orderLineDescription(o), quantity: 1, unit: "shërbim", unitPriceCents: (o.finalCents ?? o.estimatedCents)!, vatRateBp: s["vat.rateBp"] })),
    { pricesIncludeVat: true },
  );
  const buyer: Buyer = { name: company.name, nui: company.nui, address: company.address, city: company.city, email: company.billingEmail, phone: null };
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        series: s["invoice.series"],
        year: Number(month.slice(0, 4)),
        companyId,
        sellerSnapshot: {},
        buyerSnapshot: buyer,
        pricesIncludeVat: true,
        subtotalCents: totals.subtotalCents,
        vatCents: totals.vatCents,
        totalCents: totals.totalCents,
        lines: { create: totals.lines.map((l, i) => ({ ...toLineRow(l), orderId: orders[i].id })) },
      },
    });
    await audit(tx, { actorId, action: "invoice.monthly_draft_created", entityType: "Invoice", entityId: invoice.id, after: { companyId, month, orders: orders.length, totalCents: totals.totalCents } });
    return invoice;
  });
}
