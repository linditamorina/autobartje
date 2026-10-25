import { NextResponse } from "next/server";
import { cronAuthorized } from "@/server/security/cron";
import { processOutbox } from "@/server/notifications/send";
import { processWebhooks } from "@/server/partner/webhooks";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const total = { sent: 0, failed: 0, skipped: 0 };
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const r = await processOutbox(25);
    total.sent += r.sent;
    total.failed += r.failed;
    total.skipped += r.skipped;
    if (r.sent + r.failed + r.skipped < 25) break;
  }
  const webhooks = await processWebhooks(50);
  return NextResponse.json({ ...total, webhooks });
}
