import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireDriver } from "@/server/auth/guard";
import { DriverError, driverForUser, driverJob } from "@/server/driver/jobs";
import { PHOTO_ANGLES, REQUIRED_ANGLES, inspectionOpen, missingForInspection, type InspectionKind } from "@/server/driver/steps";
import { DriverHeader } from "@/components/driver/header";
import { PhotoCapture } from "@/components/driver/photo-capture";
import { InspectionForm } from "@/components/driver/inspection-form";

export const metadata = { title: "Inspection" };

export default async function InspectPage({ params }: PageProps<"/driver/jobs/[id]/inspect/[kind]">) {
  const user = await requireDriver();
  const { id, kind: rawKind } = await params;
  const kind = rawKind.toUpperCase() as InspectionKind;
  if (kind !== "PICKUP" && kind !== "DELIVERY") notFound();
  const t = await getTranslations("Driver");
  const driver = await driverForUser(user.id).catch(() => null);
  if (!driver) notFound();
  const job = await driverJob(driver.id, id).catch((err) => {
    if (err instanceof DriverError) return null;
    throw err;
  });
  if (!job) notFound();
  const { order } = job;
  const insp = order.inspections.find((i) => i.kind === kind);
  // Closed (wrong status or already signed): back to the job.
  if (!inspectionOpen(order.status, kind) || insp?.signedAt) redirect(`/driver/jobs/${order.id}`);
  const missing = missingForInspection(insp, kind);

  return (
    <>
      <DriverHeader title={`${t(kind === "PICKUP" ? "pickupInspection" : "deliveryInspection")} · ${order.number}`} back={`/driver/jobs/${order.id}`} />
      <main className="mx-auto max-w-2xl space-y-5 p-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <p className="rounded-xl bg-card p-3 text-base">
          {missing.angles.length ? t("inspectionMissing", { count: missing.angles.length }) : t("inspectionDone", { count: insp?.photos.length ?? 0 })}
        </p>
        <PhotoCapture orderId={order.id} kind={kind} angles={PHOTO_ANGLES} required={REQUIRED_ANGLES} photos={(insp?.photos ?? []).map((p) => ({ id: p.id, angle: p.angle }))} />
        <InspectionForm
          orderId={order.id}
          kind={kind}
          canSign={missing.angles.length === 0}
          defaults={{ odometerKm: insp?.odometerKm ?? null, fuelLevel: insp?.fuelLevel ?? null, notes: insp?.notes ?? null, signerName: insp?.signerName ?? null }}
        />
      </main>
    </>
  );
}
