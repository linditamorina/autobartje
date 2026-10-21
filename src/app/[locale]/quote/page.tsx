import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { QuoteCalculator } from "@/components/booking/quote-calculator";
import { ClientOnly } from "@/components/shared/client-only";
import { FormSkeleton } from "@/components/booking/form-skeleton";
import { SERVICES } from "@/lib/validation/booking";
import { alternates } from "@/lib/seo";
import { getSettings } from "@/server/settings";

export async function generateMetadata({ params }: PageProps<"/[locale]/quote">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Quote" });
  return { title: t("metaTitle"), description: t("intro"), alternates: alternates("/quote", locale) };
}

export default async function QuotePage({ params, searchParams }: PageProps<"/[locale]/quote">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, settings, sp] = await Promise.all([getTranslations("Quote"), getSettings(), searchParams]);
  const service = SERVICES.find((s) => s === sp.service);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-extrabold md:text-4xl">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-lg text-muted-foreground">{t("intro")}</p>
      <div className="mt-8">
        <ClientOnly fallback={<FormSkeleton />}>
          <QuoteCalculator phone={settings["contact.phone"]} vatRateBp={settings["vat.rateBp"]} initialService={service} />
        </ClientOnly>
      </div>
    </div>
  );
}
