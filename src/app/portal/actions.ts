"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signOut } from "@/server/auth/config";
import { assertPortal, ForbiddenError } from "@/server/auth/guard";
import { createPortalOrder } from "@/server/portal";
import { kickOutbox } from "@/server/notifications/kick";
import { rateLimit } from "@/server/security/rate-limit";
import { phoneSchema, quoteInputSchema } from "@/lib/validation/booking";

export type RequestState = { error?: string; fields?: string[] } | undefined;

const schema = z.object({
  quote: quoteInputSchema,
  vehicle: z.object({
    make: z.string().trim().min(1).max(60),
    model: z.string().trim().min(1).max(60),
    plate: z.string().trim().max(20).nullable(),
    vin: z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/).nullable(),
  }),
  customerRef: z.string().trim().max(60).nullable(),
  contactName: z.string().trim().min(2).max(100),
  contactPhone: phoneSchema,
  notes: z.string().trim().max(2000).nullable(),
});

/** The request form sends one JSON field, built from its state (addresses carry coordinates). */
export async function requestAction(_: RequestState, form: FormData): Promise<RequestState> {
  let user;
  try {
    ({ user } = await assertPortal());
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: "forbidden" };
    throw err;
  }
  if (!rateLimit(`portal-request:${user.id}`, 30, 60 * 60_000).ok) return { error: "rate_limited" };
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { error: "invalid" };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => i.path.join(".")))] };
  const { order } = await createPortalOrder(user.id, parsed.data);
  kickOutbox();
  redirect(`/portal/orders/${order.id}?created=1`);
}

export async function portalLogoutAction() {
  await signOut({ redirectTo: "/admin/login" });
}
