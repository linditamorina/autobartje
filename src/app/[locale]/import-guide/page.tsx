import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CmsPage, cmsMetadata } from "@/components/marketing/cms-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/import-guide">): Promise<Metadata> {
  const { locale } = await params;
  return cmsMetadata("import-guide", locale, "/import-guide");
}

export default async function ImportGuidePage({ params }: PageProps<"/[locale]/import-guide">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CmsPage slug="import-guide" locale={locale} quoteHref="/quote?service=INTERNATIONAL_TRANSPORT" showUpdated />;
}
