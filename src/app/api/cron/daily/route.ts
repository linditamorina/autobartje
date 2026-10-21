import { NextResponse } from "next/server";
import { cronAuthorized } from "@/server/security/cron";
import { applyRetention, fleetReminders } from "@/server/maintenance/daily";
import { markOverdue } from "@/server/invoicing/manage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Once a day (early morning Kosovo time): fleet paperwork reminders, data retention, overdue invoices. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const reminders = await fleetReminders();
  const retention = await applyRetention();
  const overdueInvoices = await markOverdue();
  return NextResponse.json({ reminders, retention, overdueInvoices });
}
