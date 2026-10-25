import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { LICENSE_CATEGORIES } from "@/server/fleet/manage";
import { dateInputValue } from "@/lib/form";
import { daysFromNow, roundedNow, toBusinessLocal } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, fmtDateTime } from "@/components/admin/ui";
import { FieldsForm, type FieldDef } from "@/components/admin/fields-form";
import { addShiftAction, deleteShiftAction, saveDriverAction } from "../../actions";

export const metadata = { title: "Driver" };

export default async function DriverPage({ params }: PageProps<"/admin/fleet/drivers/[id]">) {
  await requireStaff("fleet.manage");
  const { id } = await params;
  const now = new Date();
  const driver =
    id === "new"
      ? null
      : await db.driver.findUnique({
          where: { id },
          include: { user: true, shifts: { where: { endsAt: { gte: now }, startsAt: { lte: daysFromNow(14, now) } }, orderBy: { startsAt: "asc" } } },
        });
  if (id !== "new" && !driver) notFound();
  const [t, locale] = await Promise.all([getTranslations("Admin.fleet"), getLocale()]);

  const fields: FieldDef[] = [
    { name: "name", label: t("fullName"), required: true, defaultValue: driver?.user.name },
    { name: "email", label: t("email"), type: "email", required: true, defaultValue: driver?.user.email },
    { name: "phone", label: t("phone"), type: "tel", defaultValue: driver?.user.phone },
    { name: "locale", label: t("locale"), type: "select", defaultValue: driver?.user.locale ?? "sq", options: (["sq", "en", "de", "sr"] as const).map((l) => ({ value: l, label: t(`languages.${l}`) })) },
    { name: "licenseNumber", label: t("licenseNumber"), defaultValue: driver?.licenseNumber },
    { name: "licenseCategory", label: t("licenseCategory"), type: "select", defaultValue: driver?.licenseCategory ?? "C", options: LICENSE_CATEGORIES.map((c) => ({ value: c, label: c })) },
    { name: "licenseExpires", label: t("licenseExpires"), type: "date", required: true, defaultValue: dateInputValue(driver?.licenseExpires) },
    { name: "cpcExpires", label: t("cpcExpires"), type: "date", defaultValue: dateInputValue(driver?.cpcExpires) },
    { name: "password", label: t("password"), type: "password", help: t("passwordHelp"), required: !driver },
    { name: "isActive", label: t("active"), type: "checkbox", defaultValue: driver?.isActive ?? true },
  ];
  const start = roundedNow(60);

  return (
    <>
      <Link href="/admin/fleet" className="mb-2 inline-block text-sm font-semibold underline">← {t("title")}</Link>
      <PageHeader title={driver ? t("editDriver", { name: driver.user.name }) : t("newDriver")} />
      <div className="grid max-w-5xl gap-4 lg:grid-cols-[3fr_2fr]">
        <Panel>
          <FieldsForm
            action={saveDriverAction}
            fields={fields}
            hidden={driver ? { id: driver.id } : undefined}
            submitLabel={t("save")}
            errors={{ email_taken: t("emailTaken") }}
          />
        </Panel>
        {driver && (
          <Panel title={t("shifts")}>
            {driver.shifts.length === 0 ? (
              <p className="mb-3 text-sm text-muted-foreground">{t("noShifts")}</p>
            ) : (
              <ul className="mb-4 divide-y divide-border">
                {driver.shifts.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {fmtDateTime(s.startsAt, locale)} – {fmtDateTime(s.endsAt, locale)}
                      {s.isOnCall && <strong> · 24/7</strong>}
                      {s.note && <span className="block text-muted-foreground">{s.note}</span>}
                    </span>
                    <form action={deleteShiftAction}>
                      <input type="hidden" name="shiftId" value={s.id} />
                      <Button type="submit" variant="ghost" size="sm">{t("delete")}</Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mb-2 font-bold">{t("addShift")}</h3>
            <FieldsForm
              action={addShiftAction}
              resetOnSuccess
              hidden={{ driverId: driver.id }}
              submitLabel={t("addShift")}
              fields={[
                { name: "startsAt", label: t("shiftStart"), type: "datetime-local", required: true, defaultValue: toBusinessLocal(start) },
                { name: "endsAt", label: t("shiftEnd"), type: "datetime-local", required: true, defaultValue: toBusinessLocal(new Date(start.getTime() + 8 * 3_600_000)) },
                { name: "isOnCall", label: t("onCall"), type: "checkbox", wide: true },
                { name: "note", label: t("note"), wide: true },
              ]}
            />
          </Panel>
        )}
      </div>
    </>
  );
}
