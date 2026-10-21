import "server-only";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Private file storage on Cloudflare R2 (S3 API). Files are never public:
 * uploads and downloads use presigned URLs that expire after a few minutes.
 */
export const UPLOAD_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "application/pdf": "pdf" } as const;
export type UploadType = keyof typeof UPLOAD_TYPES;
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

let client: S3Client | null = null;

export function storageConfigured(): boolean {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
}

function s3(): S3Client {
  if (!storageConfigured()) throw new Error("R2 storage is not configured");
  client ??= new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT ?? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
    forcePathStyle: Boolean(process.env.R2_ENDPOINT), // MinIO in local development
  });
  return client;
}

const privateBucket = () => process.env.R2_PRIVATE_BUCKET ?? "autobartje-private";

export function newUploadKey(contentType: UploadType, prefix = "uploads"): string {
  const d = new Date();
  return `${prefix}/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${UPLOAD_TYPES[contentType]}`;
}

export async function presignUpload(key: string, contentType: UploadType, sizeBytes: number): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: privateBucket(), Key: key, ContentType: contentType, ContentLength: sizeBytes }),
    { expiresIn: 300 },
  );
}

export async function presignDownload(key: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: privateBucket(), Key: key }), { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: privateBucket(), Key: key }));
}
