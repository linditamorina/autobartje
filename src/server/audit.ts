import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** Writes one audit entry inside the caller's transaction. */
export async function audit(
  tx: Prisma.TransactionClient,
  entry: { actorId: string | null; action: string; entityType: string; entityId: string; before?: unknown; after?: unknown; ip?: string | null },
) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before === undefined ? undefined : (JSON.parse(JSON.stringify(entry.before)) as Prisma.InputJsonValue),
      after: entry.after === undefined ? undefined : (JSON.parse(JSON.stringify(entry.after)) as Prisma.InputJsonValue),
      ip: entry.ip ?? null,
    },
  });
}
