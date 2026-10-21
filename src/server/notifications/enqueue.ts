import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export type NotificationEvent =
  | "booking_received"
  | "booking_confirmed"
  | "driver_assigned"
  | "driver_en_route"
  | "picked_up"
  | "delivered"
  | "invoice_issued"
  | "payment_received"
  | "review_request"
  | "admin_new_order"
  | "admin_fleet_expiry";

export type Channel = "SMS" | "WHATSAPP" | "EMAIL" | "PHONE";

/**
 * Queues a message in the outbox, inside the caller's transaction, so it is sent
 * exactly when the order change commits. The cron sender delivers and retries.
 */
export async function enqueueNotification(
  tx: Prisma.TransactionClient,
  n: { event: NotificationEvent; channel: Channel; to: string; payload: Record<string, unknown>; orderId?: string; sendAfter?: Date },
) {
  // A phone-only preference is honoured as SMS for automatic messages.
  const channel = n.channel === "PHONE" ? "SMS" : n.channel;
  await tx.notificationOutbox.create({
    data: { event: n.event, channel, to: n.to, payload: n.payload as Prisma.InputJsonValue, orderId: n.orderId, sendAfter: n.sendAfter },
  });
}
