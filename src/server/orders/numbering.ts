import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Next value of a gapless counter. Runs as INSERT … ON CONFLICT DO UPDATE, so
 * concurrent callers inside transactions get distinct, consecutive numbers.
 */
export async function nextSequence(tx: Prisma.TransactionClient, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  return rows[0].value;
}

export async function nextOrderNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const seq = await nextSequence(tx, `order:${year}`);
  return `P-${year}-${String(seq).padStart(5, "0")}`;
}
