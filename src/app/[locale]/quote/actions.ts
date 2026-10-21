"use server";

import { quoteInputSchema } from "@/lib/validation/booking";
import { priceQuote, type QuoteResult } from "@/server/pricing/quote";
import { rateLimit } from "@/server/security/rate-limit";
import { clientIp } from "@/server/security/request";

export type QuoteResponse = { ok: true; quote: QuoteResult } | { ok: false; error: "invalid" | "rate_limited" | "server"; fields?: string[] };

export async function getQuote(raw: unknown): Promise<QuoteResponse> {
  const ip = (await clientIp()) ?? "unknown";
  if (!rateLimit(`quote:${ip}`, 30, 10 * 60_000).ok) return { ok: false, error: "rate_limited" };

  const parsed = quoteInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid", fields: parsed.error.issues.map((i) => i.path.join(".")) };

  try {
    return { ok: true, quote: await priceQuote(parsed.data) };
  } catch (err) {
    console.error("[quote]", err);
    return { ok: false, error: "server" };
  }
}
