import "server-only";
import { safeEqual } from "./crypto";

/** Vercel Cron sends "Authorization: Bearer $CRON_SECRET"; other schedulers can do the same. */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`);
}
