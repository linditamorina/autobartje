import "server-only";
import { NextResponse } from "next/server";
import { rateLimit } from "@/server/security/rate-limit";
import { authenticateApiKey } from "./keys";

export type ApiAuth = NonNullable<Awaited<ReturnType<typeof authenticateApiKey>>>;

const HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

export function apiError(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status, headers: HEADERS });
}

export function apiJson(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...HEADERS, ...headers } });
}

/** Runs a partner API handler with the caller's key: 401 without a valid key, 429 above 120 requests a minute. */
export async function withApiKey(req: Request, handler: (auth: ApiAuth) => Promise<Response>): Promise<Response> {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth) return apiError(401, "unauthorized", "Send a valid API key as 'Authorization: Bearer abk_…'.");
  const rl = rateLimit(`api:${auth.apiKey.id}`, 120, 60_000);
  if (!rl.ok) return apiError(429, "rate_limited", "Too many requests. Try again shortly.", { retryAfterSeconds: rl.retryAfterSec });
  return handler(auth);
}

export async function readJson(req: Request): Promise<unknown> {
  if (Number(req.headers.get("content-length") ?? 0) > 64 * 1024) return Symbol.for("too_large");
  return req.json().catch(() => undefined);
}
