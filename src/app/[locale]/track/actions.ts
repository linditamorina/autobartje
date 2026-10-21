"use server";

import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { findTrackingToken } from "@/server/orders/tracking";
import { rateLimit } from "@/server/security/rate-limit";
import { clientIp } from "@/server/security/request";

export type LookupState = { error: "not_found" | "rate_limited" } | undefined;

export async function lookupAction(_: LookupState, form: FormData): Promise<LookupState> {
  // Guessing order numbers and phones is slow: a few tries per address and per order number.
  const ip = (await clientIp()) ?? "unknown";
  const number = String(form.get("number") ?? "").trim().toUpperCase();
  if (!rateLimit(`track:${ip}`, 10, 10 * 60_000).ok || !rateLimit(`track-number:${number}`, 5, 60 * 60_000).ok) return { error: "rate_limited" };
  const token = await findTrackingToken(number, String(form.get("phone") ?? ""));
  if (!token) return { error: "not_found" };
  const raw = String(form.get("locale") ?? "");
  const locale = (routing.locales as readonly string[]).includes(raw) ? (raw as (typeof routing.locales)[number]) : routing.defaultLocale;
  redirect({ href: `/track/${token}`, locale });
}
