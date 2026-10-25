import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { enqueueNotification } from "@/server/notifications/enqueue";
import { isOpen } from "@/server/orders/status";
import { findConflicts, type Conflict } from "./conflicts";

export class AssignError extends Error {
  constructor(public code: "not_found" | "order_closed" | "conflicts", public conflicts: Conflict[] = []) {
    super(code);
  }
}

export interface AssignInput {
  orderId: string;
  driverId: string;
  truckId: string;
  start: Date;
  end: Date;
  /** Dispatcher confirmed the warnings. Blocking problems are never overridden. */
  force: boolean;
}

/**
 * Assigns (or reassigns) a driver and truck to an order. Conflicts are checked
 * under per-driver and per-truck advisory locks, so two dispatchers cannot book
 * the same truck for the same hour at once.
 */
export async function assignOrder(input: AssignInput, actorId: string) {
  return db.$transaction(async (tx) => {
    // Fixed lock order (driver, then truck) avoids deadlocks between concurrent assigns.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`driver:${input.driverId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`truck:${input.truckId}`}))`;

    const [order, driver, truck] = await Promise.all([
      tx.order.findUnique({ where: { id: input.orderId }, include: { vehicle: true, assignments: { where: { isActive: true } } } }),
      tx.driver.findUnique({ where: { id: input.driverId }, include: { user: true } }),
      tx.truck.findUnique({ where: { id: input.truckId } }),
    ]);
    if (!order || !driver || !truck) throw new AssignError("not_found");
    if (!isOpen(order.status) || order.status === "DRAFT") throw new AssignError("order_closed");

    const existing = await tx.assignment.findMany({
      where: {
        isActive: true,
        orderId: { not: order.id },
        OR: [{ driverId: driver.id }, { truckId: truck.id }],
        plannedStart: { lt: input.end },
        plannedEnd: { gt: input.start },
        order: { status: { notIn: ["CANCELLED", "COMPLETED", "DELIVERED"] } },
      },
      include: { order: { select: { number: true } } },
    });

    const conflicts = findConflicts({
      start: input.start,
      end: input.end,
      orderOptions: (order.options ?? {}) as { enclosed?: boolean; winch?: boolean },
      isDrivable: order.vehicle?.isDrivable ?? null,
      driverId: driver.id,
      driver,
      truck,
      existing: existing.map((e) => ({ orderNumber: e.order.number, driverId: e.driverId, truckId: e.truckId, start: e.plannedStart, end: e.plannedEnd })),
    });
    if (conflicts.some((c) => c.severity === "block") || (conflicts.length && !input.force)) throw new AssignError("conflicts", conflicts);

    const previous = order.assignments[0] ?? null;
    if (previous) await tx.assignment.updateMany({ where: { orderId: order.id, isActive: true }, data: { isActive: false } });
    const created = await tx.assignment.create({
      data: { orderId: order.id, driverId: driver.id, truckId: truck.id, plannedStart: input.start, plannedEnd: input.end, assignedById: actorId },
    });
    await audit(tx, {
      actorId,
      action: previous ? "order.reassigned" : "order.assigned",
      entityType: "Order",
      entityId: order.id,
      before: previous ? { driverId: previous.driverId, truckId: previous.truckId, start: previous.plannedStart } : undefined,
      after: { driver: driver.user.name, truck: truck.plate, start: input.start, end: input.end, warnings: conflicts.map((c) => c.code) },
    });

    if (driver.user.phone) {
      await enqueueNotification(tx, {
        event: "driver_assigned",
        channel: "SMS",
        to: driver.user.phone,
        orderId: order.id,
        payload: { audience: "driver", orderNumber: order.number, pickupAddress: order.pickupAddress, start: input.start.toISOString(), truckPlate: truck.plate, locale: driver.user.locale },
      });
    }
    return created;
  });
}

export async function unassignOrder(orderId: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.assignment.updateMany({ where: { orderId, isActive: true }, data: { isActive: false } });
    if (count) await audit(tx, { actorId, action: "order.unassigned", entityType: "Order", entityId: orderId });
  });
}
