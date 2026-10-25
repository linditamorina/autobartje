import "server-only";
import { db } from "@/server/db";

/** Active drivers and trucks for the assign form. */
export async function assignChoices() {
  const [drivers, trucks] = await Promise.all([
    db.driver.findMany({ where: { isActive: true, user: { isActive: true } }, include: { user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
    db.truck.findMany({ where: { isActive: true }, orderBy: { plate: "asc" } }),
  ]);
  return {
    drivers: drivers.map((d) => ({ id: d.id, name: d.user.name })),
    trucks: trucks.map((t) => ({ id: t.id, label: [t.plate, t.name, t.kind].filter(Boolean).join(" · ") })),
  };
}

/** Everything the dispatch board needs for one business day. */
export async function dispatchDay(range: { start: Date; end: Date }) {
  const [trucks, unassigned, onCall] = await Promise.all([
    db.truck.findMany({
      where: { isActive: true },
      orderBy: { plate: "asc" },
      include: {
        assignments: {
          where: { isActive: true, plannedStart: { lt: range.end }, plannedEnd: { gt: range.start }, order: { status: { not: "CANCELLED" } } },
          orderBy: { plannedStart: "asc" },
          include: {
            driver: { include: { user: { select: { name: true } } } },
            order: { select: { id: true, number: true, status: true, priority: true, service: true, pickupAddress: true, dropoffAddress: true } },
          },
        },
      },
    }),
    db.order.findMany({
      where: { status: { in: ["RECEIVED", "CONFIRMED"] }, assignments: { none: { isActive: true } } },
      orderBy: [{ priority: "desc" }, { isAsap: "desc" }, { requestedAt: "asc" }, { createdAt: "asc" }],
      take: 100,
      include: { customer: { select: { fullName: true } } },
    }),
    db.driverShift.findMany({
      where: { startsAt: { lt: range.end }, endsAt: { gt: range.start } },
      include: { driver: { include: { user: { select: { name: true, phone: true } } } } },
      orderBy: { startsAt: "asc" },
    }),
  ]);
  return { trucks, unassigned, onCall };
}
