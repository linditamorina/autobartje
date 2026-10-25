import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
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
  if (!storageConfigured() && localDir()) return void (await rm(localPath(key), { force: true }));
  await s3().send(new DeleteObjectCommand({ Bucket: privateBucket(), Key: key }));
}

/**
 * Without R2 (local development, CI) private files go to a folder instead:
 * LOCAL_STORAGE_DIR, or ".storage" outside production.
 */
function localDir(): string | null {
  if (process.env.LOCAL_STORAGE_DIR) return process.env.LOCAL_STORAGE_DIR;
  return process.env.NODE_ENV === "production" ? null : path.join(process.cwd(), ".storage");
}

function localPath(key: string): string {
  const root = path.resolve(localDir()!);
  const file = path.resolve(root, key);
  if (!file.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return file;
}

/** True when private files can be written, to R2 or to the local fallback folder. */
export function privateStorageAvailable(): boolean {
  return storageConfigured() || localDir() != null;
}

/** Writes a private file that our server has already checked (inspection photos, signatures). */
export async function putPrivateObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  if (storageConfigured()) {
    await s3().send(new PutObjectCommand({ Bucket: privateBucket(), Key: key, Body: body, ContentType: contentType }));
    return;
  }
  if (!localDir()) throw new Error("Private storage is not configured");
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function getPrivateObject(key: string): Promise<Uint8Array | null> {
  try {
    if (storageConfigured()) {
      const res = await s3().send(new GetObjectCommand({ Bucket: privateBucket(), Key: key }));
      return res.Body ? await res.Body.transformToByteArray() : null;
    }
    if (!localDir()) return null;
    return new Uint8Array(await readFile(localPath(key)));
  } catch {
    return null;
  }
}

/** Site images (logo) in the public bucket, served from R2_PUBLIC_URL. Keys are unique, so cache forever. */
export const LOGO_TYPES = { "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" } as const;
export const MAX_LOGO_BYTES = 1024 * 1024;
const publicBucket = () => process.env.R2_PUBLIC_BUCKET ?? "autobartje-public";

export function publicStorageConfigured(): boolean {
  return storageConfigured() && Boolean(process.env.R2_PUBLIC_URL);
}

export async function putPublicObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  await s3().send(
    new PutObjectCommand({ Bucket: publicBucket(), Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }),
  );
}

export async function deletePublicObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: publicBucket(), Key: key }));
}
