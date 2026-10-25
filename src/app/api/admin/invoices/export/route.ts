import { NextResponse } from "next/server";
import { assertStaff, ForbiddenError } from "@/server/auth/guard";
import { exportRows, toCsv, toXlsx } from "@/server/invoicing/export";
import { businessDayRange } from "@/lib/time";

export const dynamic = "force-dynamic";

/** GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv|xlsx (both days included, Kosovo time). */
export async function GET(req: Request) {
  try {
    await assertStaff("invoices.read");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw err;
  }
  const url = new URL(req.url);
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!day.test(from) || !day.test(to) || from > to) return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  const rows = await exportRows(businessDayRange(from).start, businessDayRange(to).end);
  const name = `faturat-${from}_${to}`;
  if (url.searchParams.get("format") === "xlsx") {
    return new NextResponse(Buffer.from(await toXlsx(rows)), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}.xlsx"`, "Cache-Control": "private, no-store" },
    });
  }
  return new NextResponse(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "private, no-store" },
  });
}
