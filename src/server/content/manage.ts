import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import type { PageSlug } from "@/content/types";
import type { LocalizedText } from "./index";

export type ContentLocale = "sq" | "en" | "de";

export class ContentError extends Error {
  constructor(public code: "duplicate" | "not_found") {
    super(code);
  }
}

export async function savePage(
  input: { slug: PageSlug; locale: ContentLocale; title: string; description: string; body: string; isPublished: boolean },
  actorId: string,
) {
  const { slug, locale, ...rest } = input;
  await db.$transaction(async (tx) => {
    const before = await tx.contentPage.findUnique({ where: { slug_locale: { slug, locale } } });
    const data = { title: rest.title, metaDescription: rest.description, blocks: { body: rest.body }, isPublished: rest.isPublished, updatedById: actorId };
    const row = await tx.contentPage.upsert({ where: { slug_locale: { slug, locale } }, create: { slug, locale, ...data }, update: data });
    await audit(tx, { actorId, action: "content.page_saved", entityType: "ContentPage", entityId: row.id, before: before && { title: before.title, isPublished: before.isPublished }, after: { slug, locale, title: rest.title, isPublished: rest.isPublished } });
  });
}

/** Drops the admin edit so the page shows the shipped default copy again. */
export async function resetPage(slug: PageSlug, locale: ContentLocale, actorId: string) {
  await db.$transaction(async (tx) => {
    const row = await tx.contentPage.findUnique({ where: { slug_locale: { slug, locale } } });
    if (!row) return;
    await tx.contentPage.delete({ where: { id: row.id } });
    await audit(tx, { actorId, action: "content.page_reset", entityType: "ContentPage", entityId: row.id, before: { slug, locale, title: row.title } });
  });
}

export async function saveFaq(
  input: { id?: string | null; locale: ContentLocale; question: string; answer: string; position: number; isPublished: boolean },
  actorId: string,
) {
  const { id, ...data } = input;
  await db.$transaction(async (tx) => {
    const row = id ? await tx.faqItem.update({ where: { id }, data }) : await tx.faqItem.create({ data });
    await audit(tx, { actorId, action: id ? "content.faq_updated" : "content.faq_created", entityType: "FaqItem", entityId: row.id, after: data });
  });
}

export async function deleteFaq(id: string, actorId: string) {
  await db.$transaction(async (tx) => {
    const row = await tx.faqItem.delete({ where: { id } });
    await audit(tx, { actorId, action: "content.faq_deleted", entityType: "FaqItem", entityId: id, before: { question: row.question, locale: row.locale } });
  });
}

export async function saveArea(
  input: { slug: string; name: LocalizedText; intro: LocalizedText; isActive: boolean; lat?: number; lng?: number; create?: boolean },
  actorId: string,
) {
  const { slug, create, lat, lng, ...data } = input;
  await db.$transaction(async (tx) => {
    if (create && (await tx.serviceArea.findUnique({ where: { slug } }))) throw new ContentError("duplicate");
    const row = create
      ? await tx.serviceArea.create({ data: { slug, ...data, lat: lat ?? 0, lng: lng ?? 0 } })
      : await tx.serviceArea.update({ where: { slug }, data: { ...data, ...(lat != null && lng != null ? { lat, lng } : {}) } });
    await audit(tx, { actorId, action: create ? "content.area_created" : "content.area_updated", entityType: "ServiceArea", entityId: row.id, after: { slug, isActive: data.isActive } });
  });
}

export async function savePost(
  input: { id?: string | null; slug: string; locale: ContentLocale; title: string; excerpt: string | null; body: string; authorName: string | null; publishedAt: Date | null },
  actorId: string,
): Promise<string> {
  const { id, ...data } = input;
  return db.$transaction(async (tx) => {
    const clash = await tx.blogPost.findUnique({ where: { slug_locale: { slug: data.slug, locale: data.locale } } });
    if (clash && clash.id !== id) throw new ContentError("duplicate");
    const row = id ? await tx.blogPost.update({ where: { id }, data }) : await tx.blogPost.create({ data });
    await audit(tx, { actorId, action: id ? "content.post_updated" : "content.post_created", entityType: "BlogPost", entityId: row.id, after: { slug: data.slug, locale: data.locale, title: data.title, publishedAt: data.publishedAt } });
    return row.id;
  });
}

export async function deletePost(id: string, actorId: string) {
  await db.$transaction(async (tx) => {
    const row = await tx.blogPost.delete({ where: { id } });
    await audit(tx, { actorId, action: "content.post_deleted", entityType: "BlogPost", entityId: id, before: { slug: row.slug, locale: row.locale, title: row.title } });
  });
}
