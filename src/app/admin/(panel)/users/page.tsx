import Link from "next/link";
import { Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { STAFF_ROLES } from "@/server/users/manage";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, fmtDateTime } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  await requireStaff("users.manage");
  const [t, locale, users] = await Promise.all([
    getTranslations("Admin.users"),
    getLocale(),
    db.user.findMany({ where: { role: { key: { in: [...STAFF_ROLES] } } }, include: { role: true }, orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
  ]);
  const now = new Date();
  return (
    <>
      <PageHeader title={t("title")}>
        <Button asChild><Link href="/admin/users/new"><Plus aria-hidden /> {t("new")}</Link></Button>
      </PageHeader>
      <p className="mb-4 text-sm text-muted-foreground">{t("intro")}</p>
      <Panel>
        <ul className="divide-y divide-border">
          {users.map((u) => (
            <li key={u.id} className={cn("flex flex-wrap items-baseline justify-between gap-2 py-3", !u.isActive && "opacity-60")}>
              <div>
                <Link href={`/admin/users/${u.id}`} className="font-bold underline">{u.name}</Link>
                <span className="ml-2 text-sm text-muted-foreground">{u.email}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{t(`roles.${u.role.key}` as never)}</span>
                {u.totpEnabledAt && <span className="rounded-full bg-muted px-2 py-0.5">2FA</span>}
                {!u.isActive && <span className="font-semibold">{t("inactive")}</span>}
                {u.lockedUntil && u.lockedUntil > now && <span className="font-semibold text-destructive">{t("locked")}</span>}
                <span className="text-muted-foreground">{t("lastLogin")}: {fmtDateTime(u.lastLoginAt, locale)}</span>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
