import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/marketing/page-shell";
import { alternates } from "@/lib/seo";
import { getAreas } from "@/server/content";

export async function generateMetadata({ params }: PageProps<"/[locale]/areas">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pages" });
  return { title: t("areasTitle"), description: t("areasIntro"), alternates: alternates("/areas", locale) };
}

export default async function AreasPage({ params }: PageProps<"/[locale]/areas">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, areas] = await Promise.all([getTranslations("Pages"), getAreas(locale)]);
  return (
    <PageShell crumbs={[{ href: "/areas", label: t("areasTitle") }]} title={t("areasTitle")} lead={t("areasIntro")}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {areas.map((a) => (
          <li key={a.slug}>
            <Link href={`/areas/${a.slug}`} className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card p-4 text-lg font-bold hover:bg-muted">
              <MapPin aria-hidden className="size-6 shrink-0 text-primary dark:text-foreground" /> {t("areaTitle", { city: a.name })}
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
