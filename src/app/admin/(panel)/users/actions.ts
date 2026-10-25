"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertStaff } from "@/server/auth/guard";
import { resetTwoFactor, saveStaff, STAFF_ROLES, unlockUser, UserError } from "@/server/users/manage";
import { phoneSchema } from "@/lib/validation/booking";
import { formReader } from "@/lib/form";

export type UserState = { ok?: boolean; error?: string; fields?: string[] } | undefined;

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.email().transform((s) => s.toLowerCase()),
  phone: phoneSchema.nullable(),
  role: z.enum(STAFF_ROLES),
  locale: z.enum(["sq", "en", "de", "sr"]),
  isActive: z.boolean(),
  password: z.string().min(12).max(200).nullable(),
});

export async function saveUserAction(_: UserState, form: FormData): Promise<UserState> {
  const actor = await assertStaff("users.manage");
  const f = formReader(form);
  const id = f.opt("id");
  const parsed = schema.safeParse({
    name: f.str("name"),
    email: f.str("email"),
    phone: f.opt("phone"),
    role: f.str("role"),
    locale: f.str("locale") || "sq",
    isActive: f.bool("isActive"),
    password: f.opt("password"),
  });
  if (!parsed.success) return { error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  if (!id && !parsed.data.password) return { error: "invalid", fields: ["password"] };
  let userId: string;
  try {
    userId = (await saveStaff(id, parsed.data, { id: actor.id, roleKey: actor.role })).id;
  } catch (err) {
    if (err instanceof UserError) return { error: err.code, fields: err.code === "email_taken" ? ["email"] : [] };
    throw err;
  }
  revalidatePath("/admin/users");
  if (!id) redirect(`/admin/users/${userId}`);
  return { ok: true };
}

export async function resetTwoFactorAction(_: UserState, form: FormData): Promise<UserState> {
  const actor = await assertStaff("users.manage");
  try {
    await resetTwoFactor(String(form.get("id")), { id: actor.id, roleKey: actor.role });
  } catch (err) {
    if (err instanceof UserError) return { error: err.code };
    throw err;
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function unlockAction(form: FormData): Promise<void> {
  const actor = await assertStaff("users.manage");
  const id = String(form.get("id"));
  await unlockUser(id, { id: actor.id, roleKey: actor.role });
  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
}
