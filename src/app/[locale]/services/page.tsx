import type { Metadata } from "next";
import { ArrowRight, Globe2, Siren, Truck, Wrench } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/marketing/page-shell";
import { SERVICE_SLUGS } from "@/content/types";
import { alternates } from "@/lib/seo";
import { getPage } from "@/server/content";

const ICONS = { "emergency-towing": Siren, "roadside-assistance": Wrench, "car-transport": Truck, "car-import": Globe2 };

export async function generateMetadata({ params }: PageProps<"/[locale]/services">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pages" });
  return { title: t("servicesTitle"), description: t("servicesIntro"), alternates: alternates("/services", locale) };
}

export default async function ServicesPage({ params }: PageProps<"/[locale]/services">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, pages] = await Promise.all([getTranslations("Pages"), Promise.all(SERVICE_SLUGS.map((s) => getPage(`services/${s}`, locale)))]);
  return (
    <PageShell crumbs={[{ href: "/services", label: t("servicesTitle") }]} title={t("servicesTitle")} lead={t("servicesIntro")}>
      <ul className="grid gap-4 sm:grid-cols-2">
        {SERVICE_SLUGS.map((slug, i) => {
          const Icon = ICONS[slug];
          return (
            <li key={slug}>
              <Card className="h-full">
                <CardHeader>
                  <Icon aria-hidden className="size-8 text-primary" />
                  <CardTitle>{pages[i].title}</CardTitle>
                  <CardDescription className="text-base">{pages[i].description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/services/${slug}`} className="inline-flex min-h-12 items-center gap-1 font-bold underline underline-offset-4">
                    {t("readMore")} <span className="sr-only">: {pages[i].title}</span> <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </PageShell>
  );
}
