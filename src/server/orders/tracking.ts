import "server-only";
import { db } from "@/server/db";
import { normalizePhone } from "@/lib/phone";
import { TOKEN_RE, type TrackStatus } from "@/lib/tracking";

/** How long the page keeps showing a finished order. */
const SHOW_CLOSED_DAYS = 30;

export type Tracking =
  | { expired: true }
  | {
      expired: false;
      number: string;
      status: TrackStatus;
      service: string;
      isAsap: boolean;
      plannedAt: Date | null;
      pickupAddress: string;
      dropoffAddress: string | null;
      driverName: string | null;
      truckPlate: string | null;
      priceCents: number | null;
      priceFinal: boolean;
      events: { status: TrackStatus; at: Date }[];
      updatedAt: Date;
    };

/** What the customer may see about their order. Only the driver's first name; no notes, no staff. */
export async function getTracking(token: string): Promise<Tracking | null> {
  if (!TOKEN_RE.test(token)) return null;
  const o = await db.order.findUnique({
    where: { trackingToken: token },
    select: {
      number: true, status: true, service: true, isAsap: true, requestedAt: true, pickupAddress: true, dropoffAddress: true,
      finalCents: true, estimatedCents: true, deliveredAt: true, cancelledAt: true, updatedAt: true,
      customer: { select: { anonymizedAt: true } },
      statusEvents: { orderBy: { createdAt: "asc" }, select: { to: true, createdAt: true } },
      assignments: { where: { isActive: true }, take: 1, select: { plannedStart: true, driver: { select: { user: { select: { name: true } } } }, truck: { select: { plate: true } } } },
    },
  });
  if (!o) return null;
  const closedAt = o.status === "CANCELLED" ? o.cancelledAt : o.status === "DELIVERED" || o.status === "COMPLETED" ? o.deliveredAt : null;
  if (o.customer.anonymizedAt || (closedAt && Date.now() - closedAt.getTime() > SHOW_CLOSED_DAYS * 86_400_000)) return { expired: true };
  const a = o.assignments[0];
  return {
    expired: false,
    number: o.number,
    status: o.status,
    service: o.service,
    isAsap: o.isAsap,
    plannedAt: a?.plannedStart ?? o.requestedAt,
    pickupAddress: o.pickupAddress,
    dropoffAddress: o.dropoffAddress,
    driverName: a ? a.driver.user.name.split(/\s+/)[0] : null,
    truckPlate: a?.truck.plate ?? null,
    priceCents: o.finalCents ?? o.estimatedCents,
    priceFinal: o.finalCents != null,
    events: o.statusEvents.map((e) => ({ status: e.to, at: e.createdAt })),
    updatedAt: o.updatedAt,
  };
}

/** Order number plus the phone it was booked with. Both must match. */
export async function findTrackingToken(number: string, phone: string): Promise<string | null> {
  const e164 = normalizePhone(phone);
  if (!e164 || !/^[A-Z0-9-]{3,40}$/i.test(number.trim())) return null;
  const o = await db.order.findFirst({
    where: { number: number.trim().toUpperCase(), customer: { phone: e164, anonymizedAt: null } },
    select: { trackingToken: true },
  });
  return o?.trackingToken ?? null;
}
