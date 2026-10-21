"use server";

import { headers } from "next/headers";
import { bookingSchema } from "@/lib/validation/booking";
import { truncateIp } from "@/lib/request";
import { createBooking } from "@/server/orders/create-booking";
import { rateLimit } from "@/server/security/rate-limit";
import { clientIp } from "@/server/security/request";
import { verifyTurnstile } from "@/server/security/turnstile";

export type BookingResponse =
  | { ok: true; orderNumber: string }
  | { ok: false; error: "invalid" | "bot" | "rate_limited" | "server"; issues?: { path: string; code: string }[] };

export async function submitBooking(raw: unknown): Promise<BookingResponse> {
  const ip = await clientIp();
  if (!rateLimit(`booking:${ip ?? "unknown"}`, 5, 10 * 60_000).ok) return { ok: false, error: "rate_limited" };

  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), code: i.message })),
    };
  }
  if (!rateLimit(`booking-phone:${parsed.data.contact.phone}`, 3, 60 * 60_000).ok) return { ok: false, error: "rate_limited" };
  if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) return { ok: false, error: "bot" };

  try {
    const userAgent = (await headers()).get("user-agent");
    const result = await createBooking(parsed.data, { ip: truncateIp(ip), userAgent });
    return { ok: true, orderNumber: result.orderNumber };
  } catch (err) {
    console.error("[booking]", err);
    return { ok: false, error: "server" };
  }
}
