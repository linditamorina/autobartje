import "server-only";
import type { Prisma } from "@/generated/prisma/client";

import type { Channel, NotificationEvent } from "./events";

export type { Channel, NotificationEvent };

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
