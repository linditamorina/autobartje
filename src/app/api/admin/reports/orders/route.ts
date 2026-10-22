import { NextResponse } from "next/server";
import { assertStaff, ForbiddenError } from "@/server/auth/guard";
import { csvTable } from "@/server/invoicing/export";
import { periodFrom } from "@/server/reports/compute";
import { exportOrders } from "@/server/reports/queries";
import { BUSINESS_TZ } from "@/lib/time";

export const dynamic = "force-dynamic";

const HEADERS = ["Porosia", "Krijuar", "Statusi", "Shërbimi", "Kanali", "Burimi", "Prioriteti", "Kompania", "Ref. klientit", "Marrja", "Dorëzimi", "Km", "Vlera (EUR)", "Çmimi final", "Shoferi", "Kamioni"];

/** GET with the same period parameters as the reports page. One row per order, without customer contact details. */
export async function GET(req: Request) {
  try {
    await assertStaff("reports.read");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw err;
  }
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const period = periodFrom(sp);
  const rows = await exportOrders(period);
  const when = new Intl.DateTimeFormat("sv-SE", { timeZone: BUSINESS_TZ, dateStyle: "short", timeStyle: "short" });
  const csv = csvTable(
    HEADERS,
    rows.map((o) => {
      const a = o.assignments[0];
      const value = o.finalCents ?? o.estimatedCents;
      return [
        o.number, when.format(o.createdAt), o.status, o.service, o.channel, o.leadSource ?? "", o.priority, o.company?.name ?? "", o.customerRef ?? "",
        o.pickupAddress, o.dropoffAddress ?? "", o.distanceKm != null ? Number(o.distanceKm) : "", value != null ? value / 100 : "", o.finalCents != null ? "po" : "jo",
        a?.driver.user.name ?? "", a?.truck.plate ?? "",
      ];
    }),
  );
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="porosite-${period.fromDate}_${period.toDate}.csv"`, "Cache-Control": "private, no-store" },
  });
}
