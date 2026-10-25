import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { defaultPage, type LocalizedText } from "@/server/content";
import { PAGE_SLUGS } from "@/content/types";
import { PageHeader, Panel, fmtDate, fmtDateTime } from "@/components/admin/ui";
import { FieldsForm, type FieldDef } from "@/components/admin/fields-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { cn } from "@/lib/utils";
import { deleteFaqAction, saveAreaAction, saveFaqAction } from "./actions";

export const metadata = { title: "Content" };

const TABS = ["pages", "faq", "areas", "blog"] as const;
type Tab = (typeof TABS)[number];
const LOCALES = ["sq", "en", "de"] as const;

export default async function ContentPage({ searchParams }: PageProps<"/admin/content">) {
  await requireStaff("cms.manage");
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "pages";
  const lang = LOCALES.includes(sp.lang as never) ? (sp.lang as (typeof LOCALES)[number]) : "sq";
  const [t, locale] = await Promise.all([getTranslations("Admin.content"), getLocale()]);
  const errors = { duplicate: t("duplicate") };

  return (
    <>
      <PageHeader title={t("title")}>
        {tab === "blog" && (
          <Link href="/admin/content/blog/new" className="inline-flex min-h-12 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground">{t("newPost")}</Link>
        )}
      </PageHeader>
      <nav className="mb-4 flex flex-wrap gap-1 border-b border-border" aria-label={t("title")}>
        {TABS.map((k) => (
          <Link key={k} href={`?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={cn("-mb-px border-b-4 px-3 py-2 font-semibold", tab === k ? "border-primary" : "border-transparent text-muted-foreground")}>
            {t(`tabs.${k}`)}
          </Link>
        ))}
      </nav>

      {tab === "pages" && <PagesTab />}
      {tab === "faq" && <FaqTab />}
      {tab === "areas" && <AreasTab />}
      {tab === "blog" && <BlogTab />}
    </>
  );

  function LangSwitch() {
    return (
      <div className="mb-4 flex gap-1" role="group" aria-label={t("language")}>
        {LOCALES.map((l) => (
          <Link key={l} href={`?tab=${tab}&lang=${l}`} aria-current={lang === l ? "true" : undefined} className={cn("inline-flex min-h-12 items-center rounded-lg border-2 px-4 font-bold uppercase", lang === l ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
            {l}
          </Link>
        ))}
      </div>
    );
  }

  async function PagesTab() {
    const rows = await db.contentPage.findMany({ select: { slug: true, locale: true, isPublished: true, updatedAt: true } });
    const edit = new Map(rows.map((r) => [`${r.slug}:${r.locale}`, r]));
    return (
      <Panel>
        <p className="mb-4 text-sm text-muted-foreground">{t("pagesIntro")}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-sm text-muted-foreground">
                <th className="p-2">{t("page")}</th>
                {LOCALES.map((l) => <th key={l} className="p-2 uppercase">{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {PAGE_SLUGS.map((slug) => (
                <tr key={slug} className="border-b border-border">
                  <td className="p-2">
                    <span className="font-semibold">{defaultPage(slug, locale).title}</span>
                    <span className="block text-sm text-muted-foreground">/{slug}</span>
                  </td>
                  {LOCALES.map((l) => {
                    const row = edit.get(`${slug}:${l}`);
                    const state = !row ? "default" : row.isPublished ? "edited" : "draft";
                    return (
                      <td key={l} className="p-2">
                        <Link href={`/admin/content/edit?slug=${encodeURIComponent(slug)}&locale=${l}`} className="inline-flex min-h-12 flex-col justify-center font-semibold underline underline-offset-4">
                          {t(`state.${state}`)}
                          {row && <span className="text-xs font-normal text-muted-foreground no-underline">{fmtDate(row.updatedAt, locale)}</span>}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    );
  }

  async function FaqTab() {
    const items = await db.faqItem.findMany({ where: { locale: lang }, orderBy: [{ position: "asc" }, { question: "asc" }] });
    const fields = (i?: (typeof items)[number]): FieldDef[] => [
      { name: "question", label: t("question"), required: true, wide: true, defaultValue: i?.question },
      { name: "answer", label: t("answer"), type: "textarea", required: true, wide: true, rows: 4, defaultValue: i?.answer },
      { name: "position", label: t("position"), type: "number", defaultValue: i?.position ?? (items.at(-1)?.position ?? 0) + 1 },
      { name: "isPublished", label: t("published"), type: "checkbox", defaultValue: i?.isPublished ?? true },
    ];
    return (
      <>
        <LangSwitch />
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="space-y-3">
            {items.length === 0 && <Panel><p className="text-muted-foreground">{t("faqEmpty")}</p></Panel>}
            {items.map((i) => (
              <Panel key={i.id}>
                <details>
                  <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-semibold">
                    <span className="text-muted-foreground">{i.position}.</span> {i.question}
                    {!i.isPublished && <span className="rounded-full bg-muted px-2 text-xs">{t("hidden")}</span>}
                  </summary>
                  <div className="mt-3 space-y-3">
                    <FieldsForm action={saveFaqAction} hidden={{ id: i.id, locale: lang }} fields={fields(i)} submitLabel={t("save")} />
                    <ConfirmButton action={deleteFaqAction} hidden={{ id: i.id }} label={t("delete")} confirm={t("deleteConfirm")} variant="emergency" />
                  </div>
                </details>
              </Panel>
            ))}
          </div>
          <Panel title={t("addQuestion")}>
            <FieldsForm action={saveFaqAction} hidden={{ locale: lang }} fields={fields()} submitLabel={t("add")} resetOnSuccess />
          </Panel>
        </div>
      </>
    );
  }

  async function AreasTab() {
    const areas = await db.serviceArea.findMany({ orderBy: { slug: "asc" } });
    const text = (v: unknown, l: string) => ((v ?? {}) as LocalizedText)[l] ?? "";
    const localized = (a?: (typeof areas)[number]): FieldDef[] =>
      LOCALES.flatMap((l) => [
        { name: `name_${l}`, label: `${t("areaName")} (${l.toUpperCase()})`, required: l === "sq", defaultValue: text(a?.name, l) },
        { name: `intro_${l}`, label: `${t("areaIntro")} (${l.toUpperCase()})`, type: "textarea" as const, rows: 5, wide: true, defaultValue: text(a?.intro, l), help: l === "sq" ? t("areaIntroHelp") : undefined },
      ]);
    return (
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {areas.map((a) => (
            <Panel key={a.id}>
              <details>
                <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-semibold">
                  {text(a.name, "sq") || a.slug} <span className="text-sm font-normal text-muted-foreground">/areas/{a.slug}</span>
                  {!a.isActive && <span className="rounded-full bg-muted px-2 text-xs">{t("hidden")}</span>}
                </summary>
                <div className="mt-3">
                  <FieldsForm
                    action={saveAreaAction}
                    hidden={{ slug: a.slug }}
                    fields={[
                      ...localized(a),
                      { name: "lat", label: t("lat"), defaultValue: a.lat },
                      { name: "lng", label: t("lng"), defaultValue: a.lng },
                      { name: "isActive", label: t("areaActive"), type: "checkbox", defaultValue: a.isActive },
                    ]}
                    submitLabel={t("save")}
                  />
                </div>
              </details>
            </Panel>
          ))}
        </div>
        <Panel title={t("addArea")}>
          <FieldsForm
            action={saveAreaAction}
            hidden={{ create: "1" }}
            fields={[
              { name: "slug", label: t("slug"), required: true, help: t("slugHelp") },
              { name: "name_sq", label: `${t("areaName")} (SQ)`, required: true },
              { name: "lat", label: t("lat"), required: true, help: t("coordsHelp") },
              { name: "lng", label: t("lng"), required: true },
            ]}
            submitLabel={t("add")}
            errors={errors}
            resetOnSuccess
          />
        </Panel>
      </div>
    );
  }

  async function BlogTab() {
    const posts = await db.blogPost.findMany({ orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { updatedAt: "desc" }] });
    const now = new Date();
    return (
      <Panel>
        {posts.length === 0 ? (
          <p className="text-muted-foreground">{t("blogEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/content/blog/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:underline">
                  <span>
                    <span className="mr-2 rounded bg-muted px-1.5 text-xs font-bold uppercase">{p.locale}</span>
                    <span className="font-semibold">{p.title}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {!p.publishedAt ? t("state.draft") : p.publishedAt > now ? t("scheduled", { date: fmtDateTime(p.publishedAt, locale) }) : fmtDate(p.publishedAt, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    );
  }
}
