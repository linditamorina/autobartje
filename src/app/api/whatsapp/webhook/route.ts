import { NextResponse } from "next/server";
import { statusUpdates, validWebhookSignature } from "@/server/notifications/whatsapp";
import { whatsappFailed } from "@/server/notifications/send";
import { kickOutbox } from "@/server/notifications/kick";

/** Meta checks the callback URL once with the verify token set in the app dashboard. */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  return new NextResponse(null, { status: 403 });
}

/** Delivery statuses. Failed messages are sent again by SMS. */
export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const body = await req.text();
  if (!validWebhookSignature(body, req.headers.get("x-hub-signature-256"), secret)) return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const failed = statusUpdates(payload).filter((s) => s.status === "failed");
  for (const s of failed) await whatsappFailed(s.id, `${s.errorCode ?? ""} ${s.errorTitle ?? "failed"}`.trim());
  if (failed.length) kickOutbox();
  return NextResponse.json({ received: true });
}
