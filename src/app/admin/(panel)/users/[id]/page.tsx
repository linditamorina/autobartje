import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { STAFF_ROLES } from "@/server/users/manage";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/admin/ui";
import { FieldsForm, type FieldDef } from "@/components/admin/fields-form";
import { ResetTwoFactor } from "@/components/admin/user-actions";
import { saveUserAction, unlockAction } from "../actions";

export const metadata = { title: "User" };

export default async function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  const actor = await requireStaff("users.manage");
  const { id } = await params;
  const user = id === "new" ? null : await db.user.findUnique({ where: { id }, include: { role: true } });
  if (id !== "new" && (!user || !(STAFF_ROLES as readonly string[]).includes(user.role.key))) notFound();
  const [t, tf] = await Promise.all([getTranslations("Admin.users"), getTranslations("Admin.fleet")]);
  const roles = STAFF_ROLES.filter((r) => r !== "OWNER" || actor.role === "OWNER" || user?.role.key === "OWNER");
  const isSelf = user?.id === actor.id;

  const fields: FieldDef[] = [
    { name: "name", label: tf("fullName"), required: true, defaultValue: user?.name },
    { name: "email", label: tf("email"), type: "email", required: true, defaultValue: user?.email },
    { name: "phone", label: t("phone"), type: "tel", defaultValue: user?.phone },
    { name: "role", label: t("role"), type: "select", defaultValue: user?.role.key ?? "DISPATCHER", options: roles.map((r) => ({ value: r, label: `${t(`roles.${r}`)} – ${t(`roleHelp.${r}`)}` })) },
    { name: "locale", label: t("locale"), type: "select", defaultValue: user?.locale ?? "sq", options: (["sq", "en", "de", "sr"] as const).map((l) => ({ value: l, label: tf(`languages.${l}`) })) },
    { name: "password", label: user ? tf("password") : t("initialPassword"), type: "password", required: !user, help: t("passwordHelp") },
    { name: "isActive", label: t("active"), type: "checkbox", defaultValue: user?.isActive ?? true, help: isSelf ? t("selfHelp") : undefined },
  ];
  const errors = Object.fromEntries((["email_taken", "owner_only", "self", "last_owner"] as const).map((k) => [k, t(`errors.${k}`)]));

  return (
    <>
      <Link href="/admin/users" className="mb-2 inline-block text-sm font-semibold underline">← {t("title")}</Link>
      <PageHeader title={user ? user.name : t("new")} />
      <div className="grid max-w-5xl gap-4 lg:grid-cols-[3fr_2fr]">
        <Panel>
          <FieldsForm action={saveUserAction} fields={fields} hidden={user ? { id: user.id } : undefined} submitLabel={t("save")} errors={errors} />
        </Panel>
        {user && !isSelf && (
          <Panel title={t("security")}>
            <p className="mb-3 text-sm text-muted-foreground">{user.totpEnabledAt ? t("has2fa") : t("no2fa")}</p>
            {user.totpEnabledAt && <ResetTwoFactor userId={user.id} />}
            {user.lockedUntil && user.lockedUntil > new Date() && (
              <form action={unlockAction} className="mt-3">
                <input type="hidden" name="id" value={user.id} />
                <Button type="submit" variant="outline">{t("unlock")}</Button>
              </form>
            )}
          </Panel>
        )}
      </div>
    </>
  );
}
