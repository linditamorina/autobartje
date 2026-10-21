import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { safeEqual } from "@/server/security/crypto";
import { hashKey, newApiKey, parseApiKey } from "./signing";

/** Creates a key for a company. The full key is returned once and never stored. */
export async function createApiKey(companyId: string, name: string, actorId: string) {
  const k = newApiKey();
  const row = await db.$transaction(async (tx) => {
    const r = await tx.apiKey.create({ data: { companyId, name, prefix: k.prefix, secretHash: k.hash, createdById: actorId } });
    await audit(tx, { actorId, action: "apikey.created", entityType: "Company", entityId: companyId, after: { apiKeyId: r.id, name, prefix: k.prefix } });
    return r;
  });
  return { key: k.key, row };
}

export async function revokeApiKey(companyId: string, id: string, actorId: string) {
  await db.$transaction(async (tx) => {
    const r = await tx.apiKey.updateMany({ where: { id, companyId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (r.count) await audit(tx, { actorId, action: "apikey.revoked", entityType: "Company", entityId: companyId, after: { apiKeyId: id } });
  });
}

export async function companyApiKeys(companyId: string) {
  return db.apiKey.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, prefix: true, lastUsedAt: true, revokedAt: true, createdAt: true } });
}

/**
 * The key from "Authorization: Bearer abk_…". Null when the key is unknown,
 * revoked, or its company is inactive.
 */
export async function authenticateApiKey(header: string | null) {
  const key = /^Bearer\s+(\S+)$/i.exec(header ?? "")?.[1];
  const parsed = key ? parseApiKey(key) : null;
  if (!key || !parsed) return null;
  const row = await db.apiKey.findUnique({ where: { prefix: parsed.prefix }, include: { company: true } });
  if (!row || row.revokedAt || !row.company.isActive || !safeEqual(row.secretHash, hashKey(key))) return null;
  // One write a minute is enough to show "last used" in the admin.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  }
  return { apiKey: { id: row.id, name: row.name }, company: row.company };
}
