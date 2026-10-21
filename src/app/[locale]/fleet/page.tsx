import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell } from "@/components/marketing/page-shell";
import { alternates } from "@/lib/seo";
import { db } from "@/server/db";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[locale]/fleet">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pages" });
  return { title: t("fleetTitle"), description: t("fleetIntro"), alternates: alternates("/fleet", locale) };
}

export default async function FleetPage({ params }: PageProps<"/[locale]/fleet">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  // Plates stay private; customers see what each truck can do.
  const trucks = await db.truck
    .findMany({ where: { isActive: true }, select: { id: true, name: true, kind: true, capacityVehicles: true, maxWeightKg: true, hasWinch: true, isEnclosed: true }, orderBy: [{ capacityVehicles: "asc" }, { name: "asc" }] })
    .catch(() => []);
  const kind = (k: string) => {
    const key = `truckKinds.${k.toLowerCase().replace(/[^a-z]+/g, "_")}`;
    return t.has(key) ? t(key as never) : k;
  };

  return (
    <PageShell crumbs={[{ href: "/fleet", label: t("fleetTitle") }]} title={t("fleetTitle")} lead={t("fleetIntro")}>
      {trucks.length === 0 ? (
        <p className="text-lg text-muted-foreground">{t("fleetEmpty")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {trucks.map((tr) => (
            <li key={tr.id} className="rounded-xl border border-border bg-card p-5">
              <Truck aria-hidden className="size-8 text-primary dark:text-foreground" />
              <h2 className="mt-2 text-xl font-extrabold">{tr.name || kind(tr.kind)}</h2>
              {tr.name && <p className="text-muted-foreground">{kind(tr.kind)}</p>}
              <ul className="mt-3 space-y-1">
                <li>{t("fleetCapacity", { count: tr.capacityVehicles })}</li>
                {tr.maxWeightKg && <li>{t("fleetWeight", { kg: tr.maxWeightKg.toLocaleString(locale) })}</li>}
                {tr.hasWinch && <li>{t("fleetWinch")}</li>}
                {tr.isEnclosed && <li>{t("fleetEnclosed")}</li>}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
