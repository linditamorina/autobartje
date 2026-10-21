import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { enqueueNotification } from "@/server/notifications/enqueue";
import { canTransition, STATUS_NOTIFICATION, type OrderStatus } from "./status";
import { nextOrderNumber } from "./numbering";
import type { Prisma } from "@/generated/prisma/client";

export class OrderError extends Error {
  constructor(public code: "not_found" | "invalid_transition" | "price_required") {
    super(code);
  }
}

/**
 * Moves an order to a new status: records the event, sends the customer the
 * matching message, and audits the change. Confirming requires a final price.
 */
export async function changeOrderStatus(
  orderId: string,
  to: OrderStatus,
  actorId: string,
  opts: { note?: string; finalCents?: number; lat?: number; lng?: number } = {},
) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { customer: true, assignments: { where: { isActive: true }, include: { driver: { include: { user: true } }, truck: true }, take: 1 } },
    });
    if (!order) throw new OrderError("not_found");
    if (!canTransition(order.status, to)) throw new OrderError("invalid_transition");
    const finalCents = opts.finalCents ?? order.finalCents;
    if (to === "CONFIRMED" && finalCents == null) throw new OrderError("price_required");

    const now = new Date();
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: to,
        finalCents,
        confirmedAt: to === "CONFIRMED" ? now : undefined,
        deliveredAt: to === "DELIVERED" ? now : undefined,
        cancelledAt: to === "CANCELLED" ? now : to === "RECEIVED" ? null : undefined,
        cancelReason: to === "CANCELLED" ? (opts.note ?? null) : undefined,
      },
    });
    await tx.orderStatusEvent.create({ data: { orderId, from: order.status, to, actorId, note: opts.note, lat: opts.lat, lng: opts.lng } });
    await audit(tx, { actorId, action: "order.status_changed", entityType: "Order", entityId: orderId, before: { status: order.status }, after: { status: to, finalCents } });

    const event = STATUS_NOTIFICATION[to];
    if (event && !order.customer.anonymizedAt) {
      const a = order.assignments[0];
      const payload = {
        orderNumber: order.number,
        customerName: order.customer.fullName,
        finalCents,
        driverName: a?.driver.user.name ?? null,
        truckPlate: a?.truck.plate ?? null,
        locale: order.locale,
      };
      await notifyCustomer(tx, order.customer, event, payload, orderId);
      if (to === "DELIVERED") {
        await notifyCustomer(tx, order.customer, "review_request", payload, orderId, new Date(now.getTime() + 2 * 3600_000));
      }
    }
    return updated;
  });
}

async function notifyCustomer(
  tx: Prisma.TransactionClient,
  c: { phone: string; email: string | null; preferredChannel: "PHONE" | "SMS" | "WHATSAPP" | "EMAIL" },
  event: Parameters<typeof enqueueNotification>[1]["event"],
  payload: Record<string, unknown>,
  orderId: string,
  sendAfter?: Date,
) {
  const useEmail = c.preferredChannel === "EMAIL" && c.email;
  await enqueueNotification(tx, { event, channel: useEmail ? "EMAIL" : c.preferredChannel === "EMAIL" ? "SMS" : c.preferredChannel, to: useEmail ? c.email! : c.phone, payload, orderId, sendAfter });
}

export async function setFinalPrice(orderId: string, finalCents: number, actorId: string) {
  return db.$transaction(async (tx) => {
    const before = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { finalCents: true } });
    await tx.order.update({ where: { id: orderId }, data: { finalCents } });
    await audit(tx, { actorId, action: "order.price_set", entityType: "Order", entityId: orderId, before, after: { finalCents } });
  });
}

export async function addOrderNote(orderId: string, body: string, actorId: string) {
  return db.orderNote.create({ data: { orderId, body, authorId: actorId } });
}

export interface ManualOrderInput {
  service: "EMERGENCY_TOWING" | "ROADSIDE_ASSISTANCE" | "DOMESTIC_TRANSPORT" | "INTERNATIONAL_TRANSPORT";
  priority: "NORMAL" | "URGENT";
  channel: "PHONE" | "WHATSAPP" | "ADMIN";
  customer: { fullName: string; phone: string; email: string | null; preferredChannel: "PHONE" | "SMS" | "WHATSAPP" | "EMAIL" };
  vehicle: { type: "CAR" | "SUV" | "VAN" | "MOTORCYCLE" | "LUXURY_LOW"; make: string | null; model: string | null; plate: string | null; isDrivable: boolean };
  pickupAddress: string;
  dropoffAddress: string | null;
  isAsap: boolean;
  requestedAt: Date | null;
  finalCents: number | null;
  note: string | null;
}

/** Order taken by phone or WhatsApp. No consents are recorded: the legal basis is the contract (GDPR art. 6(1)(b)). */
export async function createManualOrder(input: ManualOrderInput, actorId: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.customer.findFirst({ where: { phone: input.customer.phone, anonymizedAt: null }, orderBy: { createdAt: "desc" } });
    const customer =
      existing ??
      (await tx.customer.create({
        data: { fullName: input.customer.fullName, phone: input.customer.phone, email: input.customer.email, preferredChannel: input.customer.preferredChannel },
      }));
    const vehicle = await tx.vehicle.create({
      data: { customerId: customer.id, type: input.vehicle.type, make: input.vehicle.make, model: input.vehicle.model, plate: input.vehicle.plate, isDrivable: input.vehicle.isDrivable },
    });
    const number = await nextOrderNumber(tx);
    const order = await tx.order.create({
      data: {
        number,
        status: "RECEIVED",
        priority: input.priority,
        service: input.service,
        channel: input.channel,
        customerId: customer.id,
        vehicleId: vehicle.id,
        pickupAddress: input.pickupAddress,
        dropoffAddress: input.dropoffAddress,
        isAsap: input.isAsap,
        requestedAt: input.requestedAt,
        options: {},
        finalCents: input.finalCents,
        statusEvents: { create: { to: "RECEIVED", actorId, note: "Created by staff" } },
        notes: input.note ? { create: { body: input.note, authorId: actorId } } : undefined,
      },
    });
    await audit(tx, { actorId, action: "order.created", entityType: "Order", entityId: order.id, after: { number, channel: input.channel } });
    return order;
  });
}
