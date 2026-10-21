import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CmsPage, cmsMetadata } from "@/components/marketing/cms-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  return cmsMetadata("about", locale, "/about");
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CmsPage slug="about" locale={locale} />;
}
