import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/marketing/page-shell";
import { alternates } from "@/lib/seo";
import { BUSINESS_TZ } from "@/lib/time";
import { getPosts } from "@/server/content";

export async function generateMetadata({ params }: PageProps<"/[locale]/blog">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pages" });
  return { title: t("blogTitle"), description: t("blogIntro"), alternates: alternates("/blog", locale) };
}

export default async function BlogPage({ params }: PageProps<"/[locale]/blog">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, posts] = await Promise.all([getTranslations("Pages"), getPosts(locale)]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: BUSINESS_TZ });
  return (
    <PageShell crumbs={[{ href: "/blog", label: t("blogTitle") }]} title={t("blogTitle")} lead={t("blogIntro")}>
      {posts.length === 0 ? (
        <p className="text-lg text-muted-foreground">{t("blogEmpty")}</p>
      ) : (
        <ul className="space-y-4">
          {posts.map((p) => (
            <li key={p.slug}>
              <article className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-xl font-extrabold">
                  <Link href={`/blog/${p.slug}`} className="underline-offset-4 hover:underline">{p.title}</Link>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground"><time dateTime={p.publishedAt}>{date.format(new Date(p.publishedAt))}</time></p>
                {p.excerpt && <p className="mt-2 text-lg">{p.excerpt}</p>}
              </article>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
