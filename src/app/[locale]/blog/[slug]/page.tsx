import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Markdown } from "@/components/marketing/markdown";
import { PageShell } from "@/components/marketing/page-shell";
import { JsonLd } from "@/components/shared/json-ld";
import { localePath, siteUrl } from "@/lib/seo";
import { BUSINESS_TZ } from "@/lib/time";
import { getPost } from "@/server/content";

export async function generateMetadata({ params }: PageProps<"/[locale]/blog/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPost(slug, locale);
  if (!post) return {};
  // Posts are written per language, so there are no hreflang alternates.
  return { title: post.title, description: post.excerpt ?? undefined, alternates: { canonical: localePath(`/blog/${slug}`, locale) }, openGraph: { type: "article", title: post.title, publishedTime: post.publishedAt } };
}

export default async function PostPage({ params }: PageProps<"/[locale]/blog/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [t, post] = await Promise.all([getTranslations("Pages"), getPost(slug, locale)]);
  if (!post) notFound();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: BUSINESS_TZ }).format(new Date(post.publishedAt));
  return (
    <PageShell crumbs={[{ href: "/blog", label: t("blogTitle") }, { href: `/blog/${slug}`, label: post.title }]} title={post.title} lead={post.excerpt ?? undefined}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.excerpt ?? undefined,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          inLanguage: locale,
          author: post.authorName ? { "@type": "Person", name: post.authorName } : { "@id": `${siteUrl()}/#business` },
          publisher: { "@id": `${siteUrl()}/#business` },
          mainEntityOfPage: `${siteUrl()}${localePath(`/blog/${slug}`, locale)}`,
        }}
      />
      <p className="mb-6 text-sm text-muted-foreground">
        <time dateTime={post.publishedAt}>{date}</time>
        {post.authorName && ` · ${post.authorName}`}
      </p>
      <Markdown>{post.body}</Markdown>
    </PageShell>
  );
}
