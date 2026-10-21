import type { Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

export function testDb() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
}

/** An office account without 2FA (dispatcher, accountant) for tests that are not about logging in. */
export async function ensureStaff(role: "DISPATCHER" | "ACCOUNTANT", email: string, password: string) {
  const db = testDb();
  try {
    const r = await db.role.findUniqueOrThrow({ where: { key: role } });
    await db.user.upsert({
      where: { email },
      update: { failedLogins: 0, lockedUntil: null },
      create: { email, name: `E2E ${role.toLowerCase()}`, roleId: r.id, passwordHash: await hash(password) },
    });
  } finally {
    await db.$disconnect();
  }
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"));
}
