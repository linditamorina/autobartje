"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { assertStaff } from "@/server/auth/guard";
import { kickOutbox } from "@/server/notifications/kick";

/** Puts a failed message back in the queue (e.g. after fixing the SMS provider settings). */
export async function retryMessageAction(form: FormData): Promise<void> {
  const user = await assertStaff("settings.manage");
  const id = String(form.get("id") ?? "");
  await db.$transaction(async (tx) => {
    const { count } = await tx.notificationOutbox.updateMany({ where: { id, status: "FAILED" }, data: { status: "PENDING", attempts: 0, sendAfter: new Date(), lastError: null } });
    if (count) await audit(tx, { actorId: user.id, action: "message.retried", entityType: "NotificationOutbox", entityId: id });
  });
  kickOutbox();
  revalidatePath("/admin/messages");
}
