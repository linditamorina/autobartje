import "server-only";

/**
 * Fixed-window rate limiter kept in memory. On Vercel each instance has its own
 * window, so this is a speed bump in front of Turnstile rather than a hard limit;
 * swap the store for Upstash Redis if abuse shows up.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    if (windows.size > 10_000) windows.clear();
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  w.count += 1;
  return { ok: w.count <= limit, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
}
