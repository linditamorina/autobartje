import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell } from "@/components/marketing/page-shell";
import { LookupForm } from "@/components/tracking/lookup-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/track">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Track" });
  return { title: t("lookupTitle"), robots: { index: false } };
}

export default async function TrackLookupPage({ params }: PageProps<"/[locale]/track">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Track");
  return (
    <PageShell crumbs={[{ href: "/track", label: t("lookupTitle") }]} title={t("lookupTitle")} lead={t("lookupLead")}>
      <LookupForm locale={locale} />
    </PageShell>
  );
}
