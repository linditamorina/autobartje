import "server-only";
import { db } from "@/server/db";
import type { Period, ReportInvoice, ReportOrder } from "./compute";

/** Orders created in the period, flattened for the report maths. */
export async function reportOrders(p: Pick<Period, "from" | "to">): Promise<ReportOrder[]> {
  const rows = await db.order.findMany({
    where: { createdAt: { gte: p.from, lt: p.to }, status: { not: "DRAFT" } },
    select: {
      createdAt: true, status: true, service: true, channel: true, leadSource: true, priority: true, isAsap: true, companyId: true,
      finalCents: true, estimatedCents: true, distanceKm: true,
      statusEvents: { orderBy: { createdAt: "asc" }, select: { to: true, createdAt: true } },
      assignments: { where: { isActive: true }, take: 1, select: { driver: { select: { id: true, user: { select: { name: true } } } } } },
    },
  });
  return rows.map((o) => {
    const d = o.assignments[0]?.driver;
    return {
      createdAt: o.createdAt,
      status: o.status,
      service: o.service,
      channel: o.channel,
      leadSource: o.leadSource,
      priority: o.priority,
      isAsap: o.isAsap,
      companyId: o.companyId,
      valueCents: o.finalCents ?? o.estimatedCents,
      distanceKm: o.distanceKm != null ? Number(o.distanceKm) : null,
      events: o.statusEvents.map((e) => ({ to: e.to, at: e.createdAt })),
      driver: d ? { id: d.id, name: d.user.name } : null,
    };
  });
}

/** Issued invoices and credit notes (not pro formas, not drafts) issued in [from, to). */
export async function reportInvoices(from: Date, to: Date): Promise<ReportInvoice[]> {
  const rows = await db.invoice.findMany({
    where: { number: { not: null }, kind: { in: ["INVOICE", "CREDIT_NOTE"] }, status: { not: "VOID" }, issueDate: { gte: from, lt: to } },
    select: { issueDate: true, subtotalCents: true, totalCents: true },
  });
  return rows.map((r) => ({ issueDate: r.issueDate!, subtotalCents: r.subtotalCents, totalCents: r.totalCents }));
}

/** Money received in the period, by when it arrived. */
export async function reportPayments(p: Pick<Period, "from" | "to">) {
  const rows = await db.payment.findMany({
    where: { status: "SUCCEEDED", OR: [{ receivedAt: { gte: p.from, lt: p.to } }, { receivedAt: null, createdAt: { gte: p.from, lt: p.to } }] },
    select: { method: true, amountCents: true },
  });
  return rows;
}

/** Calculator quotes in the period and whether they became a booking. */
export async function reportQuotes(p: Pick<Period, "from" | "to">) {
  const rows = await db.quote.findMany({ where: { createdAt: { gte: p.from, lt: p.to } }, select: { orderId: true } });
  return rows.map((q) => ({ converted: q.orderId != null }));
}

/** One row per order for the CSV download. */
export async function exportOrders(p: Pick<Period, "from" | "to">) {
  return db.order.findMany({
    where: { createdAt: { gte: p.from, lt: p.to }, status: { not: "DRAFT" } },
    orderBy: { createdAt: "asc" },
    select: {
      number: true, createdAt: true, status: true, service: true, channel: true, leadSource: true, priority: true,
      pickupAddress: true, dropoffAddress: true, distanceKm: true, finalCents: true, estimatedCents: true, customerRef: true,
      company: { select: { name: true } },
      assignments: { where: { isActive: true }, take: 1, select: { driver: { select: { user: { select: { name: true } } } }, truck: { select: { plate: true } } } },
    },
  });
}
