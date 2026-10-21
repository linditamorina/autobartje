import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { enqueueNotification } from "@/server/notifications/enqueue";
import { nextOrderNumber } from "@/server/orders/numbering";
import { priceQuote } from "@/server/pricing/quote";
import { trackUrl } from "@/lib/tracking";
import type { QuoteInput } from "@/lib/validation/booking";

export class PortalError extends Error {
  constructor(public code: "not_found" | "no_company") {
    super(code);
  }
}

/** The signed-in portal user's company; inactive companies have no portal. */
export async function portalCompany(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true, phone: true, locale: true, company: true } });
  if (!u?.company || !u.company.isActive) throw new PortalError("no_company");
  return { profile: u, company: u.company };
}

const OPEN = ["RECEIVED", "CONFIRMED", "DRIVER_EN_ROUTE", "PICKED_UP", "IN_TRANSIT"] as const;

export async function portalOrders(companyId: string, view: "open" | "done") {
  return db.order.findMany({
    where: { companyId, status: view === "open" ? { in: [...OPEN] } : { in: ["DELIVERED", "COMPLETED", "CANCELLED"] } },
    select: {
      id: true, number: true, status: true, service: true, customerRef: true, pickupAddress: true, dropoffAddress: true, isAsap: true, requestedAt: true,
      createdAt: true, deliveredAt: true, finalCents: true, estimatedCents: true, vehicle: { select: { make: true, model: true, plate: true } },
    },
    orderBy: view === "open" ? { createdAt: "asc" } : { createdAt: "desc" },
    take: view === "open" ? 200 : 100,
  });
}

/** One order of the company, with what the office is happy to show: no internal notes, no driver phone. */
export async function portalOrder(companyId: string, id: string) {
  const o = await db.order.findFirst({
    where: { id, companyId },
    include: {
      vehicle: true,
      customer: { select: { fullName: true, phone: true } },
      statusEvents: { orderBy: { createdAt: "asc" }, select: { to: true, createdAt: true } },
      assignments: { where: { isActive: true }, take: 1, select: { plannedStart: true, driver: { select: { user: { select: { name: true } } } }, truck: { select: { plate: true } } } },
      inspections: { orderBy: { createdAt: "asc" }, include: { photos: { orderBy: { createdAt: "asc" }, select: { id: true, angle: true, takenAt: true } } } },
      invoices: { where: { status: { not: "DRAFT" } }, select: { id: true, number: true, kind: true, status: true, totalCents: true } },
    },
  });
  if (!o) throw new PortalError("not_found");
  return o;
}

export async function portalInvoices(companyId: string) {
  return db.invoice.findMany({
    // Drafts are the office's work in progress
    where: { companyId, status: { not: "DRAFT" } },
    select: { id: true, number: true, kind: true, status: true, issueDate: true, dueDate: true, totalCents: true, paidCents: true, order: { select: { number: true, trackingToken: true, locale: true } } },
    orderBy: { issueDate: "desc" },
    take: 200,
  });
}

export async function portalPrices(companyId: string) {
  const now = new Date();
  return db.contractPrice.findMany({
    where: { companyId, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] },
    orderBy: [{ service: "asc" }, { vehicleType: "asc" }],
  });
}

export interface PortalRequest {
  quote: QuoteInput;
  vehicle: { make: string; model: string; plate: string | null; vin: string | null };
  customerRef: string | null;
  contactName: string;
  contactPhone: string;
  notes: string | null;
}

/** A transport request from the portal: priced with the company's contract, then confirmed by the office as usual. */
export async function createPortalOrder(userId: string, input: PortalRequest) {
  const { profile: user, company } = await portalCompany(userId);
  const q = input.quote;
  const price = await priceQuote(q, { save: false, companyId: company.id });
  const locale = user.locale === "sr" ? "sq" : user.locale;

  const order = await db.$transaction(async (tx) => {
    // The person on site is the order's contact; status messages go to the requester's email.
    const existing = await tx.customer.findFirst({ where: { companyId: company.id, phone: input.contactPhone, anonymizedAt: null } });
    const customer = existing
      ? await tx.customer.update({ where: { id: existing.id }, data: { fullName: input.contactName, email: user.email, preferredChannel: "EMAIL", locale } })
      : await tx.customer.create({ data: { fullName: input.contactName, phone: input.contactPhone, email: user.email, preferredChannel: "EMAIL", locale, companyId: company.id } });
    const vehicle = await tx.vehicle.create({
      data: { customerId: customer.id, type: q.vehicleType, make: input.vehicle.make, model: input.vehicle.model, plate: input.vehicle.plate?.toUpperCase() || null, vin: input.vehicle.vin, isDrivable: q.isDrivable },
    });
    const number = await nextOrderNumber(tx);
    const created = await tx.order.create({
      data: {
        number,
        status: "RECEIVED",
        priority: q.isAsap && q.service === "EMERGENCY_TOWING" ? "URGENT" : "NORMAL",
        service: q.service,
        channel: "B2B_PORTAL",
        locale,
        customerRef: input.customerRef,
        customerId: customer.id,
        companyId: company.id,
        vehicleId: vehicle.id,
        pickupAddress: q.pickup.address,
        pickupLat: q.pickup.lat ?? null,
        pickupLng: q.pickup.lng ?? null,
        pickupCountry: q.pickup.country,
        dropoffAddress: q.dropoff?.address ?? null,
        dropoffLat: q.dropoff?.lat ?? null,
        dropoffLng: q.dropoff?.lng ?? null,
        dropoffCountry: q.dropoff?.country ?? null,
        distanceKm: price.distanceKm,
        durationMin: price.durationMin,
        isAsap: q.isAsap,
        requestedAt: q.isAsap ? null : (q.pickupAt ?? null),
        options: { ...q.options, isDrivable: q.isDrivable, notes: input.notes },
        estimatedCents: price.available ? price.totalCents : null,
        statusEvents: { create: { to: "RECEIVED", actorId: userId, note: "Requested in the business portal" } },
        notes: input.notes ? { create: { body: input.notes, authorId: userId } } : undefined,
      },
    });
    const payload = {
      orderNumber: number, customerName: `${company.name} (${user.name})`, service: q.service, pickup: q.pickup.address, dropoff: q.dropoff?.address ?? null,
      estimatedCents: created.estimatedCents, locale, trackUrl: trackUrl(created.trackingToken, locale),
    };
    await enqueueNotification(tx, { event: "booking_received", channel: "EMAIL", to: user.email, payload, orderId: created.id });
    if (process.env.DISPATCH_ALERT_PHONE) {
      await enqueueNotification(tx, { event: "admin_new_order", channel: "SMS", to: process.env.DISPATCH_ALERT_PHONE, payload: { ...payload, urgent: created.priority === "URGENT", phone: input.contactPhone }, orderId: created.id });
    }
    await audit(tx, { actorId: userId, action: "order.created", entityType: "Order", entityId: created.id, after: { number, channel: "B2B_PORTAL", companyId: company.id } });
    return created;
  });
  return { order, priceAvailable: price.available };
}
