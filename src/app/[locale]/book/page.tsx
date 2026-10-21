import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { FormSkeleton } from "@/components/booking/form-skeleton";
import { ClientOnly } from "@/components/shared/client-only";
import { alternates } from "@/lib/seo";
import { getSettings } from "@/server/settings";

export async function generateMetadata({ params }: PageProps<"/[locale]/book">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Booking" });
  return { title: t("metaTitle"), alternates: alternates("/book", locale), robots: { index: false } };
}

export default async function BookPage({ params }: PageProps<"/[locale]/book">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, settings] = await Promise.all([getTranslations("Booking"), getSettings()]);
  return (
    <div className="px-4 py-8">
      <h1 className="sr-only">{t("title")}</h1>
      <ClientOnly fallback={<FormSkeleton />}>
        <BookingWizard vatRateBp={settings["vat.rateBp"]} />
      </ClientOnly>
    </div>
  );
}
