"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertStaff } from "@/server/auth/guard";
import { addOrderNote, changeOrderStatus, createManualOrder, OrderError, setFinalPrice } from "@/server/orders/manage";
import { ORDER_STATUSES } from "@/server/orders/status";
import { phoneSchema, SERVICES, VEHICLE_TYPES } from "@/lib/validation/booking";
import { kickOutbox } from "@/server/notifications/kick";

export type ActionState = { ok?: boolean; error?: string } | undefined;

const eurToCents = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(",", ".").trim() : v),
  z.coerce.number().min(0).max(100_000).transform((n) => Math.round(n * 100)),
);

export async function changeStatusAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await assertStaff("orders.update");
  const parsed = z
    .object({ orderId: z.string().min(1), to: z.enum(ORDER_STATUSES), note: z.string().max(500).optional(), finalPrice: eurToCents.optional() })
    .safeParse({
      orderId: form.get("orderId"),
      to: form.get("to"),
      note: form.get("note") || undefined,
      finalPrice: form.get("finalPrice") || undefined,
    });
  if (!parsed.success) return { error: "error" };
  try {
    await changeOrderStatus(parsed.data.orderId, parsed.data.to, user.id, { note: parsed.data.note, finalCents: parsed.data.finalPrice });
    kickOutbox();
  } catch (err) {
    if (err instanceof OrderError) return { error: err.code === "price_required" ? "priceRequired" : err.code === "invalid_transition" ? "invalidTransition" : "error" };
    throw err;
  }
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  return { ok: true };
}

export async function setPriceAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await assertStaff("orders.update");
  const parsed = z.object({ orderId: z.string().min(1), finalPrice: eurToCents }).safeParse({ orderId: form.get("orderId"), finalPrice: form.get("finalPrice") });
  if (!parsed.success) return { error: "error" };
  await setFinalPrice(parsed.data.orderId, parsed.data.finalPrice, user.id);
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  return { ok: true };
}

export async function addNoteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await assertStaff("orders.read");
  const parsed = z.object({ orderId: z.string().min(1), body: z.string().trim().min(1).max(2000) }).safeParse({ orderId: form.get("orderId"), body: form.get("body") });
  if (!parsed.success) return { error: "error" };
  await addOrderNote(parsed.data.orderId, parsed.data.body, user.id);
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  return { ok: true };
}

const manualSchema = z.object({
  service: z.enum(SERVICES),
  priority: z.enum(["NORMAL", "URGENT"]),
  channel: z.enum(["PHONE", "WHATSAPP", "ADMIN"]),
  fullName: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  email: z.email().optional().or(z.literal("").transform(() => undefined)),
  preferredChannel: z.enum(["PHONE", "SMS", "WHATSAPP", "EMAIL"]),
  vehicleType: z.enum(VEHICLE_TYPES),
  make: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
  plate: z.string().trim().max(20).optional(),
  isDrivable: z.boolean(),
  pickupAddress: z.string().trim().min(3).max(300),
  dropoffAddress: z.string().trim().max(300).optional(),
  isAsap: z.boolean(),
  requestedAt: z.coerce.date().optional(),
  finalPrice: eurToCents.optional(),
  note: z.string().trim().max(2000).optional(),
});

export async function createOrderAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await assertStaff("orders.create");
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v !== "" ? v : undefined;
  };
  const parsed = manualSchema.safeParse({
    service: get("service"),
    priority: form.get("urgent") ? "URGENT" : "NORMAL",
    channel: get("channel"),
    fullName: get("fullName"),
    phone: get("phone"),
    email: get("email") ?? "",
    preferredChannel: get("preferredChannel") ?? "PHONE",
    vehicleType: get("vehicleType"),
    make: get("make"),
    model: get("model"),
    plate: get("plate"),
    isDrivable: form.get("isDrivable") === "on",
    pickupAddress: get("pickupAddress"),
    dropoffAddress: get("dropoffAddress"),
    isAsap: form.get("isAsap") === "on",
    requestedAt: get("requestedAt"),
    finalPrice: get("finalPrice"),
    note: get("note"),
  });
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.path.join(".")).join(", ") };
  const d = parsed.data;
  const order = await createManualOrder(
    {
      service: d.service,
      priority: d.priority,
      channel: d.channel,
      customer: { fullName: d.fullName, phone: d.phone, email: d.email ?? null, preferredChannel: d.preferredChannel },
      vehicle: { type: d.vehicleType, make: d.make ?? null, model: d.model ?? null, plate: d.plate?.toUpperCase() ?? null, isDrivable: d.isDrivable },
      pickupAddress: d.pickupAddress,
      dropoffAddress: d.dropoffAddress ?? null,
      isAsap: d.isAsap,
      requestedAt: d.isAsap ? null : (d.requestedAt ?? null),
      finalCents: d.finalPrice ?? null,
      note: d.note ?? null,
    },
    user.id,
  );
  redirect(`/admin/orders/${order.id}`);
}
