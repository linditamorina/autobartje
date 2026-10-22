import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth/config";
import { can } from "@/server/auth/permissions";
import { DriverError } from "@/server/driver/jobs";
import { recordPosition } from "@/server/driver/location";
import { rateLimit } from "@/server/security/rate-limit";

const body = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000).optional(),
  speed: z.number().min(0).max(100).optional(), // m/s from the Geolocation API
  heading: z.number().min(0).max(360).optional(),
  at: z.number().int().positive().optional(), // epoch ms
});

/** Live GPS from the driver app while a job is under way. Answers whether the app should keep sharing. */
export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.mfa !== "ok" || !can(user.permissions, "driver.jobs")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!rateLimit(`gps:${user.id}`, 20, 60_000).ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const d = parsed.data;
  try {
    const res = await recordPosition(user.id, {
      lat: d.lat,
      lng: d.lng,
      accuracyM: d.accuracy,
      speedKmh: d.speed != null ? d.speed * 3.6 : undefined,
      heading: d.heading,
      recordedAt: d.at ? new Date(d.at) : undefined,
    });
    return NextResponse.json(res);
  } catch (err) {
    if (err instanceof DriverError) return NextResponse.json({ error: err.code, sharing: false }, { status: 403 });
    throw err;
  }
}
