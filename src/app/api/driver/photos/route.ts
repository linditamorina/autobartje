import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth/config";
import { can } from "@/server/auth/permissions";
import { addInspectionPhoto, DriverError, MAX_PHOTO_BYTES } from "@/server/driver/jobs";
import { PHOTO_ANGLES } from "@/server/driver/steps";
import { privateStorageAvailable } from "@/server/files/storage";
import { rateLimit } from "@/server/security/rate-limit";

const fields = z.object({
  orderId: z.string().min(1),
  kind: z.enum(["PICKUP", "DELIVERY"]),
  angle: z.enum(PHOTO_ANGLES),
  takenAt: z.iso.datetime().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

/** Inspection photo upload from the driver app (multipart, one photo per request). */
export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.mfa !== "ok" || !can(user.permissions, "driver.jobs")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!privateStorageAvailable()) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  if (!rateLimit(`photo:${user.id}`, 120, 10 * 60_000).ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES + 64 * 1024) return NextResponse.json({ error: "bad_file" }, { status: 413 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const parsed = fields.safeParse({
    orderId: form?.get("orderId"),
    kind: form?.get("kind"),
    angle: form?.get("angle"),
    takenAt: form?.get("takenAt") || undefined,
    lat: form?.get("lat") || undefined,
    lng: form?.get("lng") || undefined,
  });
  if (!parsed.success || !(file instanceof File)) return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    const photo = await addInspectionPhoto(user.id, {
      ...parsed.data,
      takenAt: parsed.data.takenAt ? new Date(parsed.data.takenAt) : undefined,
      bytes: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
    });
    return NextResponse.json({ id: photo.id, sha256: photo.sha256 });
  } catch (err) {
    if (err instanceof DriverError) return NextResponse.json({ error: err.code }, { status: err.code === "not_assigned" || err.code === "not_driver" ? 403 : 400 });
    throw err;
  }
}
