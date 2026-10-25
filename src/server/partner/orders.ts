import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { createCompanyOrder } from "@/server/portal";
import { priceQuote } from "@/server/pricing/quote";
import { trackUrl } from "@/lib/tracking";
import { locationSchema, optionsSchema, phoneSchema, quoteInputSchema, SERVICES, VEHICLE_TYPES, type QuoteInput } from "@/lib/validation/booking";
import { Prisma } from "@/generated/prisma/client";

/** What partners send to price or book a job. Mirrors the portal form, with friendlier defaults. */
const jobFields = {
  service: z.enum(SERVICES),
  vehicleType: z.enum(VEHICLE_TYPES).default("CAR"),
  isDrivable: z.boolean().default(true),
  pickup: locationSchema,
  dropoff: locationSchema.nullable().default(null),
  isAsap: z.boolean().default(false),
  pickupAt: z.iso.datetime({ offset: true }).nullable().default(null),
  windowEnd: z.iso.datetime({ offset: true }).nullable().default(null),
  options: optionsSchema.partial().default({}),
};

export const apiQuoteSchema = z.object(jobFields).strict();

export const apiOrderSchema = z
  .object({
    ...jobFields,
    vehicle: z.object({
      make: z.string().trim().min(1).max(60),
      model: z.string().trim().min(1).max(60),
      plate: z.string().trim().max(20).nullable().default(null),
      vin: z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/).nullable().default(null),
    }),
    reference: z.string().trim().max(60).nullable().default(null),
    contact: z.object({ name: z.string().trim().min(2).max(100), phone: phoneSchema }),
    notes: z.string().trim().max(2000).nullable().default(null),
  })
  .strict();

export type ApiIssue = { path: string; message: string };
const issues = (e: z.ZodError): ApiIssue[] => e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));

/** Turns the partner's job description into the internal quote input, with the same checks as the website. */
export function toQuoteInput(j: z.infer<typeof apiQuoteSchema>): { ok: true; quote: QuoteInput } | { ok: false; issues: ApiIssue[] } {
  const r = quoteInputSchema.safeParse({
    service: j.service,
    vehicleType: j.vehicleType,
    isDrivable: j.isDrivable,
    pickup: j.pickup,
    dropoff: j.dropoff,
    options: optionsSchema.parse(j.options),
    isAsap: j.isAsap,
    pickupAt: j.pickupAt,
    windowStart: j.windowEnd ? j.pickupAt : null,
    windowEnd: j.windowEnd,
  });
  return r.success ? { ok: true, quote: r.data } : { ok: false, issues: issues(r.error) };
}

export function parseBody<T extends z.ZodType>(schema: T, body: unknown): { ok: true; data: z.infer<T> } | { ok: false; issues: ApiIssue[] } {
  const r = schema.safeParse(body);
  return r.success ? { ok: true, data: r.data } : { ok: false, issues: issues(r.error) };
}

export async function apiQuote(companyId: string, quote: QuoteInput) {
  const p = await priceQuote(quote, { save: false, companyId });
  return {
    available: p.available,
    reason: p.reason ?? null,
    currency: "EUR",
    netCents: p.available ? p.netCents : null,
    vatCents: p.available ? p.vatCents : null,
    totalCents: p.available ? p.totalCents : null,
    lines: p.lines.map((l) => ({ label: l.label, cents: l.cents })),
    distanceKm: p.distanceKm,
    durationMin: p.durationMin,
  };
}

const orderSelect = {
  id: true, number: true, status: true, service: true, priority: true, customerRef: true, locale: true, trackingToken: true,
  pickupAddress: true, pickupLat: true, pickupLng: true, dropoffAddress: true, dropoffLat: true, dropoffLng: true,
  isAsap: true, requestedAt: true, createdAt: true, updatedAt: true, confirmedAt: true, deliveredAt: true, cancelledAt: true,
  estimatedCents: true, finalCents: true, distanceKm: true,
  vehicle: { select: { type: true, make: true, model: true, plate: true, vin: true } },
  statusEvents: { orderBy: { createdAt: "asc" }, select: { to: true, createdAt: true } },
  assignments: { where: { isActive: true }, take: 1, select: { plannedStart: true, driver: { select: { user: { select: { name: true } } } }, truck: { select: { plate: true } } } },
  inspections: { select: { kind: true, signedAt: true, signerName: true, odometerKm: true, _count: { select: { photos: true } } } },
  invoices: { where: { status: { not: "DRAFT" }, number: { not: null } }, select: { number: true, kind: true, status: true, totalCents: true, paidCents: true } },
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

/** The order as partners see it: no internal notes, no staff, only the driver's first name. */
export function apiOrder(o: OrderRow) {
  const a = o.assignments[0];
  const place = (address: string | null, lat: number | null, lng: number | null) => (address ? { address, lat, lng } : null);
  return {
    number: o.number,
    reference: o.customerRef,
    status: o.status,
    service: o.service,
    priority: o.priority,
    pickup: place(o.pickupAddress, o.pickupLat, o.pickupLng),
    dropoff: place(o.dropoffAddress, o.dropoffLat, o.dropoffLng),
    asap: o.isAsap,
    requestedAt: o.requestedAt,
    plannedAt: a?.plannedStart ?? null,
    vehicle: o.vehicle,
    price: { currency: "EUR", estimateCents: o.estimatedCents, finalCents: o.finalCents },
    distanceKm: o.distanceKm != null ? Number(o.distanceKm) : null,
    driver: a ? { firstName: a.driver.user.name.split(/\s+/)[0], truckPlate: a.truck.plate } : null,
    inspections: o.inspections.map((i) => ({ kind: i.kind, photos: i._count.photos, odometerKm: i.odometerKm, signedAt: i.signedAt, signedBy: i.signerName })),
    invoices: o.invoices.map((i) => ({ number: i.number, kind: i.kind, status: i.status, totalCents: i.totalCents, paidCents: i.paidCents })),
    events: o.statusEvents.map((e) => ({ status: e.to, at: e.createdAt })),
    trackingUrl: trackUrl(o.trackingToken, o.locale),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    confirmedAt: o.confirmedAt,
    deliveredAt: o.deliveredAt,
    cancelledAt: o.cancelledAt,
  };
}

const OPEN = ["RECEIVED", "CONFIRMED", "DRIVER_EN_ROUTE", "PICKED_UP", "IN_TRANSIT"] as const;
const DONE = ["DELIVERED", "COMPLETED", "CANCELLED"] as const;

/** Newest first, 50 per page; `cursor` is the last order number of the previous page. */
export async function listApiOrders(companyId: string, q: { status?: string | null; updatedSince?: Date | null; reference?: string | null; cursor?: string | null; limit?: number }) {
  const limit = Math.min(100, Math.max(1, q.limit ?? 50));
  const status = q.status === "open" ? { in: [...OPEN] } : q.status === "done" ? { in: [...DONE] } : { not: "DRAFT" as const };
  const after = q.cursor ? await db.order.findFirst({ where: { companyId, number: q.cursor }, select: { id: true } }) : null;
  const rows = await db.order.findMany({
    where: { companyId, status, ...(q.updatedSince ? { updatedAt: { gte: q.updatedSince } } : {}), ...(q.reference ? { customerRef: q.reference } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(after ? { cursor: { id: after.id }, skip: 1 } : {}),
    select: orderSelect,
  });
  const page = rows.slice(0, limit);
  return { data: page.map(apiOrder), nextCursor: rows.length > limit ? page.at(-1)!.number : null };
}

export async function getApiOrder(companyId: string, number: string) {
  const o = await db.order.findFirst({ where: { companyId, number, status: { not: "DRAFT" } }, select: orderSelect });
  return o ? apiOrder(o) : null;
}

/**
 * Books a job for the company. With an Idempotency-Key, a repeated request
 * returns the order made the first time instead of booking twice.
 */
export async function createApiOrder(
  company: { id: string; name: string; billingEmail: string | null },
  apiKey: { id: string; name: string },
  input: z.infer<typeof apiOrderSchema>,
  quote: QuoteInput,
  idempotencyKey: string | null,
): Promise<{ order: ReturnType<typeof apiOrder>; replayed: boolean }> {
  if (idempotencyKey) {
    const prior = await db.apiIdempotency.findUnique({ where: { companyId_key: { companyId: company.id, key: idempotencyKey } } });
    if (prior) {
      const o = await db.order.findUniqueOrThrow({ where: { id: prior.orderId }, select: orderSelect });
      return { order: apiOrder(o), replayed: true };
    }
  }
  const { order } = await createCompanyOrder(
    company,
    { kind: "api", apiKeyId: apiKey.id, name: apiKey.name, email: company.billingEmail, locale: "sq" },
    { quote, vehicle: input.vehicle, customerRef: input.reference, contactName: input.contact.name, contactPhone: input.contact.phone, notes: input.notes },
  );
  if (idempotencyKey) {
    try {
      await db.apiIdempotency.create({ data: { companyId: company.id, key: idempotencyKey, orderId: order.id } });
    } catch (err) {
      // Two identical requests at the same moment: keep the first order, cancel this one.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const prior = await db.apiIdempotency.findUniqueOrThrow({ where: { companyId_key: { companyId: company.id, key: idempotencyKey } } });
        await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Duplicate API request" } });
        const o = await db.order.findUniqueOrThrow({ where: { id: prior.orderId }, select: orderSelect });
        return { order: apiOrder(o), replayed: true };
      }
      throw err;
    }
  }
  const o = await db.order.findUniqueOrThrow({ where: { id: order.id }, select: orderSelect });
  return { order: apiOrder(o), replayed: false };
}
