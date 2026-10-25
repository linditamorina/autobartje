import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { defaultPage } from "@/server/content";
import { isPageSlug } from "@/content/types";
import { localePath } from "@/lib/seo";
import { PageHeader, Panel, fmtDateTime } from "@/components/admin/ui";
import { FieldsForm } from "@/components/admin/fields-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { resetPageAction, savePageAction } from "../actions";

export const metadata = { title: "Edit page" };

const LOCALES = ["sq", "en", "de"] as const;

export default async function EditPage({ searchParams }: PageProps<"/admin/content/edit">) {
  await requireStaff("cms.manage");
  const sp = await searchParams;
  const slug = String(sp.slug ?? "");
  const lang = LOCALES.find((l) => l === sp.locale);
  if (!isPageSlug(slug) || !lang) notFound();
  const [t, locale, row] = await Promise.all([
    getTranslations("Admin.content"),
    getLocale(),
    db.contentPage.findUnique({ where: { slug_locale: { slug, locale: lang } } }),
  ]);
  const base = defaultPage(slug, lang);
  const current = row ? { title: row.title, description: row.metaDescription ?? "", body: (row.blocks as { body?: string } | null)?.body ?? "" } : base;
  const editor = row?.updatedById ? await db.user.findUnique({ where: { id: row.updatedById }, select: { name: true } }) : null;

  return (
    <>
      <PageHeader title={`${current.title} · ${lang.toUpperCase()}`}>
        <a href={localePath(`/${slug}`, lang)} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center rounded-lg border-2 border-border px-4 font-semibold hover:bg-muted">{t("view")}</a>
      </PageHeader>
      <p className="mb-4">
        <Link href="/admin/content" className="font-semibold underline underline-offset-4">← {t("title")}</Link>
        <span className="ml-3 inline-flex gap-1">
          {LOCALES.map((l) => (
            <Link key={l} href={`?slug=${encodeURIComponent(slug)}&locale=${l}`} aria-current={l === lang ? "true" : undefined} className={l === lang ? "rounded px-2 font-bold uppercase underline" : "rounded px-2 uppercase"}>{l}</Link>
          ))}
        </span>
      </p>
      {sp.reset && <p role="status" className="mb-4 rounded-lg bg-muted p-3 font-semibold">{t("resetDone")}</p>}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Panel>
          <FieldsForm
            key={sp.reset ? "reset" : "form"}
            action={savePageAction}
            hidden={{ slug, locale: lang }}
            fields={[
              { name: "title", label: t("pageTitle"), required: true, wide: true, defaultValue: current.title },
              { name: "description", label: t("pageDescription"), type: "textarea", wide: true, rows: 2, defaultValue: current.description, help: t("pageDescriptionHelp") },
              { name: "body", label: t("pageBody"), type: "textarea", wide: true, rows: 24, required: true, defaultValue: current.body.trim() },
              { name: "isPublished", label: t("publishEdit"), type: "checkbox", wide: true, defaultValue: row ? row.isPublished : true },
            ]}
            submitLabel={t("save")}
          />
        </Panel>
        <div className="space-y-4">
          <Panel title={t("status")}>
            <p>{t(`state.${!row ? "default" : row.isPublished ? "edited" : "draft"}`)}</p>
            {row && (
              <p className="mt-1 text-sm text-muted-foreground">
                {fmtDateTime(row.updatedAt, locale)}
                {editor?.name && ` · ${editor.name}`}
              </p>
            )}
            {row && (
              <div className="mt-3">
                <ConfirmButton action={resetPageAction} hidden={{ slug, locale: lang }} label={t("reset")} confirm={t("resetConfirm")} />
              </div>
            )}
          </Panel>
          <Panel title={t("help")}>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>{t("helpHeadings")}</li>
              <li>{t("helpLists")}</li>
              <li>{t("helpLinks")}</li>
              <li>{t("helpPlaceholders")}</li>
            </ul>
            <p className="mt-2 break-words font-mono text-xs text-muted-foreground">{"{{brand.name}} {{company.legalName}} {{company.address}} {{company.city}} {{company.nui}} {{contact.phone}} {{contact.email}}"}</p>
            {slug.startsWith("legal/") && <p className="mt-3 rounded bg-muted p-2 text-sm font-semibold">{t("legalNote")}</p>}
          </Panel>
        </div>
      </div>
    </>
  );
}
