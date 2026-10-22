import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { fillPlaceholders } from "@/content/fill";
import { de } from "@/content/de";
import { en } from "@/content/en";
import { sq } from "@/content/sq";
import type { PageCopy, PageSet, PageSlug } from "@/content/types";

export const CONTENT_TAG = "content";

const DEFAULTS: Record<string, PageSet> = { sq, en, de };

/** Shipped copy for a page; locales without their own copy fall back to Albanian. */
export function defaultPage(slug: PageSlug, locale: string): PageCopy {
  return (DEFAULTS[locale] ?? sq)[slug];
}

export type PublicPage = PageCopy & { updatedAt: string | null };

const loadPage = unstable_cache(
  async (slug: PageSlug, locale: string): Promise<PublicPage> => {
    try {
      const row = await db.contentPage.findUnique({ where: { slug_locale: { slug, locale: locale as never } } });
      if (row?.isPublished) {
        const body = (row.blocks as { body?: string } | null)?.body ?? "";
        return { title: row.title, description: row.metaDescription ?? "", body, updatedAt: row.updatedAt.toISOString() };
      }
    } catch (err) {
      console.warn("[content] falling back to default copy:", (err as Error).message);
    }
    return { ...defaultPage(slug, locale), updatedAt: null };
  },
  ["content-page"],
  { tags: [CONTENT_TAG], revalidate: 3600 },
);

/** The published admin edit if there is one, otherwise the default copy, with settings filled in. */
export async function getPage(slug: PageSlug, locale: string): Promise<PublicPage> {
  const [page, settings] = await Promise.all([loadPage(slug, locale), getSettings()]);
  const fill = (s: string) => fillPlaceholders(s, settings);
  return { ...page, title: fill(page.title), description: fill(page.description), body: fill(page.body) };
}

export const getFaq = unstable_cache(
  async (locale: string) => {
    try {
      return await db.faqItem.findMany({
        where: { locale: locale as never, isPublished: true },
        orderBy: [{ position: "asc" }, { question: "asc" }],
        select: { id: true, question: true, answer: true, category: true },
      });
    } catch {
      return [];
    }
  },
  ["content-faq"],
  { tags: [CONTENT_TAG], revalidate: 3600 },
);

export type LocalizedText = Partial<Record<string, string>>;
export type Area = { slug: string; name: string; intro: string | null; lat: number; lng: number };

function pick(text: unknown, locale: string): string | null {
  const t = (text ?? {}) as LocalizedText;
  return t[locale] || t.sq || null;
}

export const getAreas = unstable_cache(
  async (locale: string): Promise<Area[]> => {
    try {
      const rows = await db.serviceArea.findMany({ where: { isActive: true } });
      return rows
        .map((a) => ({ slug: a.slug, name: pick(a.name, locale) ?? a.slug, intro: pick(a.intro, locale), lat: a.lat, lng: a.lng }))
        .sort((a, b) => a.name.localeCompare(b.name, locale));
    } catch {
      return [];
    }
  },
  ["content-areas"],
  { tags: [CONTENT_TAG], revalidate: 3600 },
);

export type PostSummary = { slug: string; title: string; excerpt: string | null; publishedAt: string; updatedAt: string };

export const getPosts = unstable_cache(
  async (locale: string): Promise<PostSummary[]> => {
    try {
      const rows = await db.blogPost.findMany({
        where: { locale: locale as never, publishedAt: { lte: new Date() } },
        orderBy: { publishedAt: "desc" },
        select: { slug: true, title: true, excerpt: true, publishedAt: true, updatedAt: true },
      });
      return rows.map((p) => ({ ...p, publishedAt: p.publishedAt!.toISOString(), updatedAt: p.updatedAt.toISOString() }));
    } catch {
      return [];
    }
  },
  ["content-posts"],
  // Scheduled posts appear within the hour.
  { tags: [CONTENT_TAG], revalidate: 3600 },
);

export const getPost = unstable_cache(
  async (slug: string, locale: string) => {
    try {
      const p = await db.blogPost.findUnique({ where: { slug_locale: { slug, locale: locale as never } } });
      if (!p?.publishedAt || p.publishedAt > new Date()) return null;
      return { slug: p.slug, title: p.title, excerpt: p.excerpt, body: p.body, authorName: p.authorName, publishedAt: p.publishedAt.toISOString(), updatedAt: p.updatedAt.toISOString() };
    } catch {
      return null;
    }
  },
  ["content-post"],
  { tags: [CONTENT_TAG], revalidate: 3600 },
);
