import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { CONSENT_POLICY_VERSION } from "@/lib/consent";
import { truncateIp } from "@/lib/request";

const body = z.object({ analytics: z.boolean(), marketing: z.boolean() });

/** Logs a cookie choice as proof of consent. Stores a random visitor id and a truncated IP only. */
export async function POST(req: NextRequest) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const visitorId = req.cookies.get("ab_vid")?.value ?? randomUUID();
  const ip = truncateIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent")?.slice(0, 255) ?? null;
  await db.consent.createMany({
    data: [
      { visitorId, type: "COOKIES_ANALYTICS", granted: parsed.data.analytics, policyVersion: CONSENT_POLICY_VERSION, ip, userAgent },
      { visitorId, type: "COOKIES_MARKETING", granted: parsed.data.marketing, policyVersion: CONSENT_POLICY_VERSION, ip, userAgent },
    ],
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("ab_vid", visitorId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 180, path: "/" });
  return res;
}
