import type { Metadata } from "next";
import type { PageSlug } from "@/content/types";
import { alternates } from "@/lib/seo";
import { getPage } from "@/server/content";
import { Markdown } from "./markdown";
import { PageShell, type Crumb } from "./page-shell";

export async function cmsMetadata(slug: PageSlug, locale: string, path: string): Promise<Metadata> {
  const page = await getPage(slug, locale);
  return { title: page.title, description: page.description, alternates: alternates(path, locale), openGraph: { title: page.title, description: page.description } };
}

/** A page whose copy is edited in admin → Content. */
export async function CmsPage({
  slug,
  locale,
  crumbs = [],
  quoteHref,
  showUpdated,
  children,
}: {
  slug: PageSlug;
  locale: string;
  /** Parent crumbs; the page itself is added last. */
  crumbs?: Crumb[];
  quoteHref?: string;
  showUpdated?: boolean;
  children?: React.ReactNode;
}) {
  const page = await getPage(slug, locale);
  return (
    <PageShell crumbs={[...crumbs, { href: `/${slug}`, label: page.title }]} title={page.title} lead={page.description} updatedAt={showUpdated ? page.updatedAt : null} quoteHref={quoteHref}>
      <Markdown>{page.body}</Markdown>
      {children}
    </PageShell>
  );
}
