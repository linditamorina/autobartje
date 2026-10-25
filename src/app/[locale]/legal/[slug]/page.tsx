import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { CmsPage, cmsMetadata } from "@/components/marketing/cms-page";
import { routing } from "@/i18n/routing";

const LEGAL = ["terms", "privacy", "cookies"] as const;
type Legal = (typeof LEGAL)[number];
const isLegal = (s: string): s is Legal => (LEGAL as readonly string[]).includes(s);

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => LEGAL.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/legal/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLegal(slug)) return {};
  return cmsMetadata(`legal/${slug}`, locale, `/legal/${slug}`);
}

export default async function LegalPage({ params }: PageProps<"/[locale]/legal/[slug]">) {
  const { locale, slug } = await params;
  if (!isLegal(slug)) notFound();
  setRequestLocale(locale);
  return <CmsPage slug={`legal/${slug}`} locale={locale} showUpdated />;
}
