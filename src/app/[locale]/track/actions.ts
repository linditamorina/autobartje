"use server";

import { redirect as redirectExternal } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { createCheckout, PaymentError } from "@/server/payments/stripe";
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

export type PayState = { error: "nothing_due" | "unavailable" | "rate_limited" } | undefined;

export async function payAction(_: PayState, form: FormData): Promise<PayState> {
  const ip = (await clientIp()) ?? "unknown";
  if (!rateLimit(`pay:${ip}`, 10, 10 * 60_000).ok) return { error: "rate_limited" };
  let url: string;
  try {
    url = await createCheckout(String(form.get("token") ?? ""));
  } catch (err) {
    if (err instanceof PaymentError) return { error: err.code === "nothing_due" ? "nothing_due" : "unavailable" };
    console.error("[checkout]", err);
    return { error: "unavailable" };
  }
  redirectExternal(url);
}
