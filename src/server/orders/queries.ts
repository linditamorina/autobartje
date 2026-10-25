import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { ORDER_STATUSES, type OrderStatus } from "./status";

export interface OrderFilters {
  q?: string;
  status?: string;
  service?: string;
  page?: number;
}

const SERVICES = ["EMERGENCY_TOWING", "ROADSIDE_ASSISTANCE", "DOMESTIC_TRANSPORT", "INTERNATIONAL_TRANSPORT"] as const;
export const PAGE_SIZE = 50;

export function orderWhere(f: OrderFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = { status: { not: "DRAFT" } };
  if (f.status === "open") where.status = { notIn: ["DRAFT", "DELIVERED", "COMPLETED", "CANCELLED"] };
  else if (ORDER_STATUSES.includes(f.status as OrderStatus)) where.status = f.status as OrderStatus;
  if (SERVICES.includes(f.service as (typeof SERVICES)[number])) where.service = f.service as (typeof SERVICES)[number];
  const q = f.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { customer: { fullName: { contains: q, mode: "insensitive" } } },
      { vehicle: { plate: { contains: q.replace(/\s/g, ""), mode: "insensitive" } } },
      { pickupAddress: { contains: q, mode: "insensitive" } },
      ...(digits.length >= 5 ? [{ customer: { phone: { contains: digits.slice(-8) } } }] : []),
    ];
  }
  return where;
}

export async function listOrders(f: OrderFilters) {
  const where = orderWhere(f);
  const page = Math.max(1, f.page ?? 1);
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      include: { customer: { select: { fullName: true, phone: true } }, vehicle: { select: { make: true, model: true, plate: true } } },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.order.count({ where }),
  ]);
  return { orders, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type OrderListItem = Awaited<ReturnType<typeof listOrders>>["orders"][number];
