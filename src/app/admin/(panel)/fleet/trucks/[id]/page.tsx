import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { TRUCK_KINDS } from "@/server/fleet/manage";
import { dateInputValue } from "@/lib/form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { FieldsForm, type FieldDef } from "@/components/admin/fields-form";
import { saveTruckAction } from "../../actions";

export const metadata = { title: "Truck" };

export default async function TruckPage({ params }: PageProps<"/admin/fleet/trucks/[id]">) {
  await requireStaff("fleet.manage");
  const { id } = await params;
  const truck = id === "new" ? null : await db.truck.findUnique({ where: { id } });
  if (id !== "new" && !truck) notFound();
  const t = await getTranslations("Admin.fleet");

  const fields: FieldDef[] = [
    { name: "plate", label: t("plate"), required: true, defaultValue: truck?.plate },
    { name: "name", label: t("name"), defaultValue: truck?.name },
    { name: "kind", label: t("kind"), type: "select", defaultValue: truck?.kind ?? "flatbed", options: TRUCK_KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) })) },
    { name: "capacityVehicles", label: t("capacity"), type: "number", required: true, defaultValue: truck?.capacityVehicles ?? 1 },
    { name: "maxWeightKg", label: t("maxWeight"), type: "number", defaultValue: truck?.maxWeightKg },
    { name: "odometerKm", label: t("odometer"), type: "number", defaultValue: truck?.odometerKm },
    { name: "insuranceExpires", label: t("insurance"), type: "date", defaultValue: dateInputValue(truck?.insuranceExpires) },
    { name: "registrationExpires", label: t("registration"), type: "date", defaultValue: dateInputValue(truck?.registrationExpires) },
    { name: "inspectionExpires", label: t("inspection"), type: "date", defaultValue: dateInputValue(truck?.inspectionExpires) },
    { name: "nextServiceAt", label: t("nextService"), type: "date", defaultValue: dateInputValue(truck?.nextServiceAt) },
    { name: "nextServiceKm", label: t("nextServiceKm"), type: "number", defaultValue: truck?.nextServiceKm },
    { name: "hasWinch", label: t("winch"), type: "checkbox", defaultValue: truck?.hasWinch ?? true },
    { name: "isEnclosed", label: t("enclosed"), type: "checkbox", defaultValue: truck?.isEnclosed ?? false },
    { name: "isActive", label: t("active"), type: "checkbox", defaultValue: truck?.isActive ?? true },
  ];

  return (
    <>
      <Link href="/admin/fleet" className="mb-2 inline-block text-sm font-semibold underline">← {t("title")}</Link>
      <PageHeader title={truck ? t("editTruck", { plate: truck.plate }) : t("newTruck")} />
      <Panel className="max-w-3xl">
        <FieldsForm action={saveTruckAction} fields={fields} hidden={truck ? { id: truck.id } : undefined} submitLabel={t("save")} errors={{ plate_taken: t("plateTaken") }} />
      </Panel>
    </>
  );
}
