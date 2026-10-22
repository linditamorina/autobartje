"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertStaff } from "@/server/auth/guard";
import { CONTENT_TAG } from "@/server/content";
import { ContentError, deleteFaq, deletePost, resetPage, saveArea, saveFaq, savePage, savePost } from "@/server/content/manage";
import { isPageSlug } from "@/content/types";
import { formReader } from "@/lib/form";
import { fromBusinessLocal } from "@/lib/time";

export type ContentState = { ok?: boolean; error?: string; fields?: string[] } | undefined;

const LOCALES = ["sq", "en", "de"] as const;
const locale = z.enum(LOCALES);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const fail = (e: z.ZodError): ContentState => ({ error: "invalid", fields: [...new Set(e.issues.map((i) => String(i.path[0])))] });

function done(): ContentState {
  updateTag(CONTENT_TAG);
  revalidatePath("/admin/content", "layout");
  return { ok: true };
}

async function guard(fn: () => Promise<unknown>): Promise<ContentState | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    if (err instanceof ContentError) return { error: err.code };
    throw err;
  }
}

export async function savePageAction(_: ContentState, form: FormData): Promise<ContentState> {
  const user = await assertStaff("cms.manage");
  const f = formReader(form);
  const parsed = z
    .object({ slug: z.string().refine(isPageSlug), locale, title: z.string().min(1).max(120), description: z.string().max(300), body: z.string().min(1).max(50_000), isPublished: z.boolean() })
    .safeParse({ slug: f.str("slug"), locale: f.str("locale"), title: f.str("title"), description: f.str("description"), body: String(form.get("body") ?? ""), isPublished: f.bool("isPublished") });
  if (!parsed.success) return fail(parsed.error);
  await savePage(parsed.data as Parameters<typeof savePage>[0], user.id);
  return done();
}

export async function resetPageAction(_: ContentState, form: FormData): Promise<ContentState> {
  const user = await assertStaff("cms.manage");
  const f = formReader(form);
  const s = f.str("slug");
  const l = locale.safeParse(f.str("locale"));
  if (!isPageSlug(s) || !l.success) return { error: "invalid" };
  await resetPage(s, l.data, user.id);
  done();
  redirect(`/admin/content/edit?slug=${encodeURIComponent(s)}&locale=${l.data}&reset=1`);
}

export async function saveFaqAction(_: ContentState, form: FormData): Promise<ContentState> {
  const user = await assertStaff("cms.manage");
  const f = formReader(form);
  const parsed = z
    .object({ id: z.string().nullable(), locale, question: z.string().min(3).max(200), answer: z.string().min(1).max(2000), position: z.number().int().min(0).max(999), isPublished: z.boolean() })
    .safeParse({ id: f.opt("id"), locale: f.str("locale"), question: f.str("question"), answer: f.str("answer"), position: f.int("position") ?? 0, isPublished: f.bool("isPublished") });
  if (!parsed.success) return fail(parsed.error);
  await saveFaq(parsed.data, user.id);
  return done();
}

export async function deleteFaqAction(_: ContentState, form: FormData): Promise<ContentState> {
  const user = await assertStaff("cms.manage");
  const id = formReader(form).str("id");
  if (!id) return { error: "invalid" };
  await deleteFaq(id, user.id);
  return done();
}

const coord = (min: number, max: number) => z.number().min(min).max(max).nullable();

export async function saveAreaAction(_: ContentState, form: FormData): Promise<ContentState> {
  const user = await assertStaff("cms.manage");
  const f = formReader(form);
  const create = f.bool("create");
  const num = (k: string) => (f.str(k) === "" ? null : Number(f.str(k).replace(",", ".")));
  const parsed = z
    .object({
      slug,
      lat: coord(41, 43.5),
      lng: coord(19.5, 22),
      isActive: z.boolean(),
      ...Object.fromEntries(LOCALES.flatMap((l) => [[`name_${l}`, l === "sq" ? z.string().min(2).max(60) : z.string().max(60)], [`intro_${l}`, z.string().max(10_000)]])),
    })
    .safeParse({
      slug: f.str("slug"),
      lat: num("lat"),
      lng: num("lng"),
      isActive: create || f.bool("isActive"),
      ...Object.fromEntries(LOCALES.flatMap((l) => [[`name_${l}`, f.str(`name_${l}`)], [`intro_${l}`, String(form.get(`intro_${l}`) ?? "").trim()]])),
    });
  if (!parsed.success) return fail(parsed.error);
  if (create && (parsed.data.lat == null || parsed.data.lng == null)) return { error: "invalid", fields: ["lat", "lng"] };
  const d = parsed.data as unknown as Record<string, string>;
  const name = Object.fromEntries(LOCALES.map((l) => [l, d[`name_${l}`] || d.name_sq]));
  const intro = Object.fromEntries(LOCALES.filter((l) => d[`intro_${l}`]).map((l) => [l, d[`intro_${l}`]]));
  return (
    (await guard(() => saveArea({ slug: parsed.data.slug, name, intro, isActive: parsed.data.isActive, lat: parsed.data.lat ?? undefined, lng: parsed.data.lng ?? undefined, create }, user.id))) ?? done()
  );
}

export async function savePostAction(_: ContentState, form: FormData): Promise<ContentState> {
  const user = await assertStaff("cms.manage");
  const f = formReader(form);
  const publish = f.str("publishedAt");
  const parsed = z
    .object({
      id: z.string().nullable(),
      slug,
      locale,
      title: z.string().min(3).max(140),
      excerpt: z.string().max(300).nullable(),
      body: z.string().min(1).max(100_000),
      authorName: z.string().max(80).nullable(),
      publishedAt: z.date().nullable(),
    })
    .safeParse({
      id: f.opt("id"),
      slug: f.str("slug"),
      locale: f.str("locale"),
      title: f.str("title"),
      excerpt: f.opt("excerpt"),
      body: String(form.get("body") ?? ""),
      authorName: f.opt("authorName"),
      publishedAt: publish ? fromBusinessLocal(publish) : null,
    });
  if (!parsed.success) return fail(parsed.error);
  let id = "";
  const err = await guard(async () => {
    id = await savePost(parsed.data, user.id);
  });
  if (err) return err;
  done();
  if (!parsed.data.id) redirect(`/admin/content/blog/${id}?saved=1`);
  return { ok: true };
}

export async function deletePostAction(_: ContentState, form: FormData): Promise<ContentState> {
  const user = await assertStaff("cms.manage");
  const id = formReader(form).str("id");
  if (!id) return { error: "invalid" };
  await deletePost(id, user.id);
  done();
  redirect("/admin/content?tab=blog");
}
