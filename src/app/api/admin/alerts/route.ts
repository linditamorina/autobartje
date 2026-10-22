import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { assertStaff } from "@/server/auth/guard";

/** New orders since a timestamp, polled by the admin panel for sound/desktop alerts. */
export async function GET(req: NextRequest) {
  try {
    await assertStaff("orders.read");
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sinceParam = Number(req.nextUrl.searchParams.get("since"));
  const since = Number.isFinite(sinceParam) && sinceParam > 0 ? new Date(sinceParam) : new Date(Date.now() - 60_000);
  const orders = await db.order.findMany({
    where: { createdAt: { gt: since }, status: { not: "DRAFT" } },
    select: { id: true, number: true, priority: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  return NextResponse.json({ now: Date.now(), orders }, { headers: { "Cache-Control": "no-store" } });
}
