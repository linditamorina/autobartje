import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Markdown } from "@/components/marketing/markdown";
import { PageShell } from "@/components/marketing/page-shell";
import { JsonLd } from "@/components/shared/json-ld";
import { alternates, siteUrl } from "@/lib/seo";
import { getAreas } from "@/server/content";

async function findArea(slug: string, locale: string) {
  return (await getAreas(locale)).find((a) => a.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/areas/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const area = await findArea(slug, locale);
  if (!area) return {};
  const t = await getTranslations({ locale, namespace: "Pages" });
  return { title: t("areaTitle", { city: area.name }), description: t("areaLead", { city: area.name }), alternates: alternates(`/areas/${slug}`, locale) };
}

export default async function AreaPage({ params }: PageProps<"/[locale]/areas/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [t, areas] = await Promise.all([getTranslations("Pages"), getAreas(locale)]);
  const area = areas.find((a) => a.slug === slug);
  if (!area) notFound();
  const title = t("areaTitle", { city: area.name });
  return (
    <PageShell crumbs={[{ href: "/areas", label: t("areasTitle") }, { href: `/areas/${slug}`, label: area.name }]} title={title} lead={t("areaLead", { city: area.name })}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: title,
          provider: { "@id": `${siteUrl()}/#business` },
          areaServed: { "@type": "City", name: area.name, geo: { "@type": "GeoCoordinates", latitude: area.lat, longitude: area.lng } },
        }}
      />
      <Markdown>{area.intro || t("areaBody", { city: area.name })}</Markdown>
      <h2 className="mt-10 mb-3 text-2xl font-extrabold">{t("areaOther")}</h2>
      <ul className="flex flex-wrap gap-2">
        {areas
          .filter((a) => a.slug !== slug)
          .map((a) => (
            <li key={a.slug}>
              <Link href={`/areas/${a.slug}`} className="inline-flex min-h-12 items-center rounded-full border border-border px-4 font-semibold hover:bg-muted">{a.name}</Link>
            </li>
          ))}
      </ul>
    </PageShell>
  );
}
