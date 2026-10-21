import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { getSettings } from "@/server/settings";
import { enqueueNotification } from "@/server/notifications/enqueue";
import { nextSequence } from "@/server/orders/numbering";
import { BUSINESS_TZ, businessDate, daysFromNow } from "@/lib/time";
import { formatPhone } from "@/lib/contact";
import type { Prisma } from "@/generated/prisma/client";
import { calculateInvoice, formatDocumentNumber, paymentStatus, type LineInput } from "./calc";
import type { InvoiceDoc } from "./pdf";
import { trackUrl } from "@/lib/tracking";

export class InvoiceError extends Error {
  constructor(public code: "not_found" | "not_draft" | "no_lines" | "no_price" | "exists" | "not_issued" | "overpaid" | "no_buyer") {
    super(code);
  }
}

export type Buyer = { name: string; nui: string | null; address: string | null; city: string | null; email: string | null; phone: string | null };
type Tx = Prisma.TransactionClient;

const SERVICE_SQ: Record<string, string> = {
  EMERGENCY_TOWING: "Tërheqje automjeti",
  ROADSIDE_ASSISTANCE: "Ndihmë në rrugë",
  DOMESTIC_TRANSPORT: "Transport automjeti",
  INTERNATIONAL_TRANSPORT: "Transport ndërkombëtar automjeti",
};

/** Draft invoice for one order: one line at the confirmed price (VAT included), buyer from the company or customer. */
export async function createInvoiceFromOrder(orderId: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { customer: true, company: true, vehicle: true, invoices: { where: { kind: "INVOICE", status: { not: "VOID" } } } } });
    if (!order) throw new InvoiceError("not_found");
    if (order.invoices.length) throw new InvoiceError("exists");
    const gross = order.finalCents ?? order.estimatedCents;
    if (gross == null) throw new InvoiceError("no_price");
    const s = await getSettings();

    const c = order.company;
    const buyer: Buyer = c
      ? { name: c.name, nui: c.nui, address: c.address, city: c.city, email: c.billingEmail, phone: null }
      : { name: order.customer.fullName, nui: null, address: null, city: null, email: order.customer.email, phone: order.customer.phone };
    const vehicle = order.vehicle ? [order.vehicle.make, order.vehicle.model, order.vehicle.plate].filter(Boolean).join(" ") : "";
    const route = [order.pickupAddress, order.dropoffAddress].filter(Boolean).join(" → ");
    const description = [`${SERVICE_SQ[order.service]} ${order.number}`, route, vehicle, order.distanceKm ? `${order.distanceKm} km` : ""].filter(Boolean).join(", ");
    // Customers are quoted prices with VAT included: invoice exactly that amount.
    const totals = calculateInvoice([{ description, quantity: 1, unit: "shërbim", unitPriceCents: gross, vatRateBp: s["vat.rateBp"] }], { pricesIncludeVat: true });

    const invoice = await tx.invoice.create({
      data: {
        series: s["invoice.series"],
        year: Number(businessDate().slice(0, 4)),
        orderId: order.id,
        customerId: order.customerId,
        companyId: order.companyId,
        sellerSnapshot: {},
        buyerSnapshot: buyer,
        pricesIncludeVat: true,
        subtotalCents: totals.subtotalCents,
        vatCents: totals.vatCents,
        totalCents: totals.totalCents,
        lines: { create: totals.lines.map(toLineRow) },
      },
    });
    await audit(tx, { actorId, action: "invoice.draft_created", entityType: "Invoice", entityId: invoice.id, after: { orderNumber: order.number, totalCents: totals.totalCents } });
    return invoice;
  });
}

function toLineRow(l: ReturnType<typeof calculateInvoice>["lines"][number]) {
  return { position: l.position, description: l.description, quantity: l.quantity, unit: l.unit, unitPriceCents: l.unitPriceCents, vatRateBp: l.vatRateBp, netCents: l.netCents, vatCents: l.vatCents, grossCents: l.grossCents };
}

/** Replaces buyer and lines of a draft. Issued invoices never change. */
export async function updateDraft(id: string, buyer: Buyer, lines: LineInput[], pricesIncludeVat: boolean, actorId: string) {
  if (!lines.length) throw new InvoiceError("no_lines");
  const totals = calculateInvoice(lines, { pricesIncludeVat });
  return db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id } });
    if (!inv) throw new InvoiceError("not_found");
    if (inv.status !== "DRAFT") throw new InvoiceError("not_draft");
    await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
    await tx.invoice.update({
      where: { id },
      data: { buyerSnapshot: buyer, pricesIncludeVat, subtotalCents: totals.subtotalCents, vatCents: totals.vatCents, totalCents: totals.totalCents, lines: { create: totals.lines.map(toLineRow) } },
    });
    await audit(tx, { actorId, action: "invoice.draft_updated", entityType: "Invoice", entityId: id, after: { buyer: buyer.name, totalCents: totals.totalCents } });
  });
}

async function sellerSnapshot() {
  const s = await getSettings();
  return {
    name: s["brand.name"],
    legalName: s["company.legalName"],
    nui: s["company.nui"],
    address: s["company.address"],
    city: s["company.city"],
    iban: s["company.iban"],
    bank: s["company.bank"],
    phone: formatPhone(s["contact.phone"]),
    email: s["contact.email"],
    brandColor: s["brand.primaryColor"],
    paymentTermsDays: s["invoice.paymentTermsDays"],
  };
}

/**
 * Issues a draft: takes the next number in its series and year (gapless, never
 * reused), freezes seller and buyer details, and emails the PDF to the buyer.
 */
export async function issueInvoice(id: string, actorId: string) {
  const seller = await sellerSnapshot();
  const issued = await db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id }, include: { lines: true, company: true, order: { select: { locale: true, trackingToken: true } } } });
    if (!inv) throw new InvoiceError("not_found");
    if (inv.status !== "DRAFT") throw new InvoiceError("not_draft");
    if (!inv.lines.length) throw new InvoiceError("no_lines");
    const buyer = inv.buyerSnapshot as Buyer;
    if (!buyer?.name) throw new InvoiceError("no_buyer");
    const year = Number(businessDate().slice(0, 4));
    const sequence = await nextSequence(tx, `invoice:${inv.series}:${year}`);
    const number = formatDocumentNumber(inv.series, year, sequence);
    const terms = inv.company?.paymentTermsDays ?? seller.paymentTermsDays;
    const now = new Date();
    const updated = await tx.invoice.update({
      where: { id },
      data: { number, year, sequence, status: "ISSUED", issueDate: now, dueDate: inv.kind === "CREDIT_NOTE" ? null : daysFromNow(terms, now), sellerSnapshot: seller },
    });
    await audit(tx, { actorId, action: "invoice.issued", entityType: "Invoice", entityId: id, after: { number, totalCents: inv.totalCents } });

    // Cash the driver already collected for this order counts towards the invoice.
    let paidCents = 0;
    if (inv.kind === "INVOICE" && inv.orderId) {
      const loose = await tx.payment.findMany({ where: { orderId: inv.orderId, invoiceId: null, status: "SUCCEEDED" }, orderBy: { createdAt: "asc" } });
      for (const p of loose) {
        if (paidCents + p.amountCents > inv.totalCents) continue;
        await tx.payment.update({ where: { id: p.id }, data: { invoiceId: id } });
        paidCents += p.amountCents;
      }
      if (paidCents > 0) {
        Object.assign(updated, await tx.invoice.update({ where: { id }, data: { paidCents, status: paymentStatus(inv.totalCents, paidCents, updated.dueDate, now) } }));
      }
    }
    if (buyer.email) {
      await enqueueNotification(tx, {
        event: "invoice_issued",
        channel: "EMAIL",
        to: buyer.email,
        orderId: inv.orderId ?? undefined,
        payload: { invoiceId: id, invoiceNumber: number, totalCents: inv.totalCents, locale: inv.order?.locale ?? "sq", url: inv.order && inv.kind === "INVOICE" ? trackUrl(inv.order.trackingToken, inv.order.locale) : undefined },
      });
    }
    return updated;
  });
  return issued;
}

/** Cancels an issued invoice with a credit note for the full amount (the original keeps its number). */
export async function creditInvoice(id: string, actorId: string) {
  const seller = await sellerSnapshot();
  return db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id }, include: { lines: true } });
    if (!inv) throw new InvoiceError("not_found");
    if (inv.kind !== "INVOICE" || !["ISSUED", "OVERDUE", "PARTIALLY_PAID", "PAID"].includes(inv.status)) throw new InvoiceError("not_issued");
    const year = Number(businessDate().slice(0, 4));
    const sequence = await nextSequence(tx, `invoice:${inv.series}:${year}`);
    const number = formatDocumentNumber(inv.series, year, sequence);
    const credit = await tx.invoice.create({
      data: {
        kind: "CREDIT_NOTE",
        number,
        series: inv.series,
        year,
        sequence,
        status: "ISSUED",
        orderId: inv.orderId,
        customerId: inv.customerId,
        companyId: inv.companyId,
        creditedInvoiceId: inv.id,
        sellerSnapshot: seller,
        buyerSnapshot: inv.buyerSnapshot as Prisma.InputJsonValue,
        pricesIncludeVat: inv.pricesIncludeVat,
        issueDate: new Date(),
        subtotalCents: -inv.subtotalCents,
        vatCents: -inv.vatCents,
        totalCents: -inv.totalCents,
        lines: {
          create: inv.lines.map((l) => ({ position: l.position, description: l.description, quantity: l.quantity, unit: l.unit, unitPriceCents: -l.unitPriceCents, vatRateBp: l.vatRateBp, netCents: -l.netCents, vatCents: -l.vatCents, grossCents: -l.grossCents })),
        },
      },
    });
    await tx.invoice.update({ where: { id }, data: { status: "VOID" } });
    await audit(tx, { actorId, action: "invoice.credited", entityType: "Invoice", entityId: id, after: { creditNote: number } });
    return credit;
  });
}

export async function recordPayment(
  invoiceId: string,
  p: { amountCents: number; method: "CASH" | "CARD" | "BANK_TRANSFER"; receivedAt: Date; reference: string | null },
  actorId: string,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { customer: true, order: { select: { locale: true } } } });
    if (!inv) throw new InvoiceError("not_found");
    if (inv.kind !== "INVOICE" || !["ISSUED", "OVERDUE", "PARTIALLY_PAID"].includes(inv.status)) throw new InvoiceError("not_issued");
    if (inv.paidCents + p.amountCents > inv.totalCents) throw new InvoiceError("overpaid");
    await tx.payment.create({
      data: { invoiceId, orderId: inv.orderId, method: p.method, status: "SUCCEEDED", amountCents: p.amountCents, bankReference: p.reference, receivedById: actorId, receivedAt: p.receivedAt },
    });
    const paidCents = inv.paidCents + p.amountCents;
    const status = paymentStatus(inv.totalCents, paidCents, inv.dueDate);
    await tx.invoice.update({ where: { id: invoiceId }, data: { paidCents, status } });
    await audit(tx, { actorId, action: "invoice.payment_recorded", entityType: "Invoice", entityId: invoiceId, after: { amountCents: p.amountCents, method: p.method, status } });
    const buyer = inv.buyerSnapshot as Buyer;
    if (status === "PAID" && buyer.email) {
      await enqueueNotification(tx, { event: "payment_received", channel: "EMAIL", to: buyer.email, orderId: inv.orderId ?? undefined, payload: { amountCents: paidCents, invoiceNumber: inv.number, locale: inv.order?.locale ?? "sq" } });
    }
  });
}

/** Daily: issued invoices past their due date become OVERDUE. */
export async function markOverdue(now = new Date()) {
  const { count } = await db.invoice.updateMany({ where: { kind: "INVOICE", status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueDate: { lt: now } }, data: { status: "OVERDUE" } });
  return count;
}

/** Data for the PDF, from the stored snapshots. */
export async function invoiceDoc(id: string, tx: Tx | typeof db = db): Promise<InvoiceDoc | null> {
  const inv = await tx.invoice.findUnique({ where: { id }, include: { lines: { orderBy: { position: "asc" } }, order: { select: { number: true } } } });
  if (!inv || !inv.number || !inv.issueDate) return null;
  const credited = inv.creditedInvoiceId ? await tx.invoice.findUnique({ where: { id: inv.creditedInvoiceId }, select: { number: true } }) : null;
  const seller = inv.sellerSnapshot as InvoiceDoc["seller"] & { brandColor?: string };
  return {
    kind: inv.kind,
    number: inv.number,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    seller,
    buyer: inv.buyerSnapshot as Buyer,
    orderNumber: inv.order?.number ?? null,
    creditedNumber: credited?.number ?? null,
    lines: inv.lines.map((l) => ({ ...l, quantity: Number(l.quantity) })),
    subtotalCents: inv.subtotalCents,
    vatCents: inv.vatCents,
    totalCents: inv.totalCents,
    paidCents: inv.paidCents,
    pricesIncludeVat: inv.pricesIncludeVat,
    brandColor: seller.brandColor ?? "#0b2545",
    timeZone: BUSINESS_TZ,
  };
}
