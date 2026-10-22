import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CmsPage, cmsMetadata } from "@/components/marketing/cms-page";
import { JsonLd } from "@/components/shared/json-ld";
import { SERVICE_CODE, SERVICE_SLUGS, type ServiceSlug } from "@/content/types";
import { routing } from "@/i18n/routing";
import { localePath, siteUrl } from "@/lib/seo";
import { getPage } from "@/server/content";

const isService = (s: string): s is ServiceSlug => (SERVICE_SLUGS as readonly string[]).includes(s);

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => SERVICE_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/services/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isService(slug)) return {};
  return cmsMetadata(`services/${slug}`, locale, `/services/${slug}`);
}

export default async function ServicePage({ params }: PageProps<"/[locale]/services/[slug]">) {
  const { locale, slug } = await params;
  if (!isService(slug)) notFound();
  setRequestLocale(locale);
  const [t, page] = await Promise.all([getTranslations("Pages"), getPage(`services/${slug}`, locale)]);
  const base = siteUrl();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: page.title,
          description: page.description,
          url: `${base}${localePath(`/services/${slug}`, locale)}`,
          provider: { "@id": `${base}/#business` },
          areaServed: { "@type": "Country", name: "Kosovo" },
        }}
      />
      <CmsPage slug={`services/${slug}`} locale={locale} crumbs={[{ href: "/services", label: t("servicesTitle") }]} quoteHref={`/quote?service=${SERVICE_CODE[slug]}`} />
    </>
  );
}
