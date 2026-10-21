import { NextResponse } from "next/server";
import { auth } from "@/server/auth/config";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { getPrivateObject } from "@/server/files/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * Inspection photos and signatures. Office staff who can see orders get any of
 * them; a driver only those of a job assigned to them; a business customer
 * those of their company's orders. `id` is a photo id, or
 * `sig-<inspectionId>` for the customer's signature.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/files/inspection/[id]">) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.mfa !== "ok") return new NextResponse(null, { status: 401 });
  const { id } = await ctx.params;

  let key: string | null = null;
  let orderId: string | null = null;
  if (id.startsWith("sig-")) {
    const insp = await db.inspection.findUnique({ where: { id: id.slice(4) }, select: { signatureKey: true, orderId: true } });
    key = insp?.signatureKey ?? null;
    orderId = insp?.orderId ?? null;
  } else {
    const photo = await db.inspectionPhoto.findUnique({ where: { id }, select: { objectKey: true, inspection: { select: { orderId: true } } } });
    key = photo?.objectKey ?? null;
    orderId = photo?.inspection.orderId ?? null;
  }
  if (!key || !orderId) return new NextResponse(null, { status: 404 });

  const office = can(user.permissions, "orders.read");
  if (!office) {
    const assigned = can(user.permissions, "driver.jobs") && (await db.assignment.count({ where: { orderId, isActive: true, driver: { userId: user.id } } })) > 0;
    const ownCompany =
      !assigned &&
      can(user.permissions, "portal.orders") &&
      (await db.order.count({ where: { id: orderId, company: { isActive: true, users: { some: { id: user.id } } } } })) > 0;
    if (!assigned && !ownCompany) return new NextResponse(null, { status: 403 });
  }

  const bytes = await getPrivateObject(key);
  if (!bytes) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": TYPES[key.split(".").pop() ?? ""] ?? "application/octet-stream", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
