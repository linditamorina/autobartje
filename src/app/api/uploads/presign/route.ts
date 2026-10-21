import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { MAX_UPLOAD_BYTES, newUploadKey, presignUpload, storageConfigured, UPLOAD_TYPES, type UploadType } from "@/server/files/storage";
import { rateLimit } from "@/server/security/rate-limit";

const body = z.object({
  contentType: z.enum(Object.keys(UPLOAD_TYPES) as [UploadType, ...UploadType[]]),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

/** Public endpoint used by the booking form to upload vehicle photos straight to R2. */
export async function POST(req: NextRequest) {
  if (!storageConfigured()) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const limit = rateLimit(`presign:${ip}`, 20, 10 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const key = newUploadKey(parsed.data.contentType);
  const url = await presignUpload(key, parsed.data.contentType, parsed.data.size);
  return NextResponse.json({ key, url });
}

export function GET() {
  return NextResponse.json({ enabled: storageConfigured() });
}
