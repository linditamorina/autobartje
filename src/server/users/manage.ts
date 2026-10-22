import "server-only";
import { hash } from "@node-rs/argon2";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

/** Staff roles managed on /admin/users. Drivers are managed under Fleet, B2B users under Customers. */
export const STAFF_ROLES = ["OWNER", "ADMIN", "DISPATCHER", "ACCOUNTANT"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export class UserError extends Error {
  constructor(public code: "not_found" | "email_taken" | "owner_only" | "self" | "last_owner") {
    super(code);
  }
}

type Actor = { id: string; roleKey: string };

function ensureOwnerRules(actor: Actor, targetRole: string | null, newRole: string | null) {
  // Only an owner can create, edit or promote to owner.
  if ((targetRole === "OWNER" || newRole === "OWNER") && actor.roleKey !== "OWNER") throw new UserError("owner_only");
}

async function assertNotLastOwner(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], userId: string) {
  const owners = await tx.user.count({ where: { isActive: true, role: { key: "OWNER" }, id: { not: userId } } });
  if (owners === 0) throw new UserError("last_owner");
}

export interface StaffInput {
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  locale: "sq" | "en" | "de" | "sr";
  isActive: boolean;
  password: string | null;
}

export async function saveStaff(id: string | null, input: StaffInput, actor: Actor) {
  const passwordHash = input.password ? await hash(input.password) : undefined;
  return db.$transaction(async (tx) => {
    const existing = id ? await tx.user.findUnique({ where: { id }, include: { role: true } }) : null;
    if (id && (!existing || !(STAFF_ROLES as readonly string[]).includes(existing.role.key))) throw new UserError("not_found");
    ensureOwnerRules(actor, existing?.role.key ?? null, input.role);
    const clash = await tx.user.findUnique({ where: { email: input.email } });
    if (clash && clash.id !== id) throw new UserError("email_taken");
    if (existing && existing.id === actor.id && (!input.isActive || input.role !== existing.role.key)) throw new UserError("self");
    if (existing?.role.key === "OWNER" && (input.role !== "OWNER" || !input.isActive)) await assertNotLastOwner(tx, existing.id);

    const role = await tx.role.findUniqueOrThrow({ where: { key: input.role } });
    // Role change, deactivation or new password signs the user out everywhere.
    const revoke = existing && (existing.roleId !== role.id || (existing.isActive && !input.isActive) || Boolean(passwordHash));
    const data = { name: input.name, email: input.email, phone: input.phone, locale: input.locale, isActive: input.isActive, roleId: role.id };
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { ...data, ...(passwordHash ? { passwordHash, failedLogins: 0, lockedUntil: null } : {}), ...(revoke ? { tokenVersion: { increment: 1 } } : {}) },
        })
      : await tx.user.create({ data: { ...data, passwordHash: passwordHash! } });
    await audit(tx, {
      actorId: actor.id,
      action: existing ? "user.updated" : "user.created",
      entityType: "User",
      entityId: user.id,
      before: existing ? { name: existing.name, email: existing.email, role: existing.role.key, isActive: existing.isActive } : undefined,
      after: { name: input.name, email: input.email, role: input.role, isActive: input.isActive, passwordChanged: Boolean(passwordHash) },
    });
    return user;
  });
}

/** Lost phone: removes the authenticator so the user sets it up again on next login, and signs them out. */
export async function resetTwoFactor(id: string, actor: Actor) {
  return db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id }, include: { role: true } });
    if (!target) throw new UserError("not_found");
    if (target.id === actor.id) throw new UserError("self");
    ensureOwnerRules(actor, target.role.key, null);
    await tx.user.update({ where: { id }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, tokenVersion: { increment: 1 } } });
    await audit(tx, { actorId: actor.id, action: "user.2fa_reset", entityType: "User", entityId: id });
  });
}

export async function unlockUser(id: string, actor: Actor) {
  return db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { failedLogins: 0, lockedUntil: null } });
    await audit(tx, { actorId: actor.id, action: "user.unlocked", entityType: "User", entityId: id });
  });
}
