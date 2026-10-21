"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertStaff } from "@/server/auth/guard";
import { AssignError, assignOrder, unassignOrder } from "@/server/dispatch/assign";
import type { Conflict } from "@/server/dispatch/conflicts";
import { fromBusinessLocal } from "@/lib/time";
import { kickOutbox } from "@/server/notifications/kick";

export type AssignState = { ok?: boolean; error?: string; conflicts?: Conflict[] } | undefined;

const assignSchema = z
  .object({
    orderId: z.string().min(1),
    driverId: z.string().min(1),
    truckId: z.string().min(1),
    start: z.string().transform((v, ctx) => fromBusinessLocal(v) ?? (ctx.addIssue({ code: "custom", message: "date" }), z.NEVER)),
    durationMin: z.coerce.number().int().min(15).max(14 * 24 * 60),
    force: z.boolean(),
  })
  .transform((v) => ({ ...v, end: new Date(v.start.getTime() + v.durationMin * 60_000) }));

export async function assignAction(_: AssignState, form: FormData): Promise<AssignState> {
  const user = await assertStaff("orders.assign");
  const parsed = assignSchema.safeParse({
    orderId: form.get("orderId"),
    driverId: form.get("driverId"),
    truckId: form.get("truckId"),
    start: form.get("start"),
    durationMin: form.get("durationMin"),
    force: form.get("force") === "1",
  });
  if (!parsed.success) return { error: "invalid" };
  try {
    await assignOrder(parsed.data, user.id);
    kickOutbox();
  } catch (err) {
    if (err instanceof AssignError) return { error: err.code, conflicts: err.conflicts };
    throw err;
  }
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  revalidatePath("/admin/dispatch");
  return { ok: true };
}

export async function unassignAction(form: FormData): Promise<void> {
  const user = await assertStaff("orders.assign");
  const orderId = String(form.get("orderId") ?? "");
  if (!orderId) return;
  await unassignOrder(orderId, user.id);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/dispatch");
}
