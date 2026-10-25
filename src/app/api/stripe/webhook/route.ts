import { NextResponse } from "next/server";
import { handleStripeEvent, parseWebhook, stripeEnabled } from "@/server/payments/stripe";
import { kickOutbox } from "@/server/notifications/kick";

export async function POST(req: Request) {
  if (!stripeEnabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const body = await req.text();
  let event;
  try {
    event = parseWebhook(body, req.headers.get("stripe-signature"));
  } catch {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }
  // A failure answers 500, so Stripe retries the event later.
  await handleStripeEvent(event);
  kickOutbox();
  return NextResponse.json({ received: true });
}
