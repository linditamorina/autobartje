import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell } from "@/components/marketing/page-shell";
import { JsonLd } from "@/components/shared/json-ld";
import { alternates } from "@/lib/seo";
import { getFaq } from "@/server/content";

export async function generateMetadata({ params }: PageProps<"/[locale]/faq">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pages" });
  return { title: t("faqTitle"), description: t("faqIntro"), alternates: alternates("/faq", locale) };
}

export default async function FaqPage({ params }: PageProps<"/[locale]/faq">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, items] = await Promise.all([getTranslations("Pages"), getFaq(locale)]);
  return (
    <PageShell crumbs={[{ href: "/faq", label: t("faqTitle") }]} title={t("faqTitle")} lead={t("faqIntro")}>
      {items.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((i) => ({ "@type": "Question", name: i.question, acceptedAnswer: { "@type": "Answer", text: i.answer } })),
          }}
        />
      )}
      {items.length === 0 ? (
        <p className="text-lg text-muted-foreground">{t("faqEmpty")}</p>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {items.map((i) => (
            <details key={i.id} className="group p-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
                {i.question}
                <span aria-hidden className="text-2xl transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 whitespace-pre-line text-lg leading-relaxed">{i.answer}</p>
            </details>
          ))}
        </div>
      )}
    </PageShell>
  );
}
