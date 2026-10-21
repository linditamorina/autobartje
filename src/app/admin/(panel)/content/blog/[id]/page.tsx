import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { localePath } from "@/lib/seo";
import { toBusinessLocal } from "@/lib/time";
import { PageHeader, Panel } from "@/components/admin/ui";
import { FieldsForm } from "@/components/admin/fields-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deletePostAction, savePostAction } from "../../actions";

export const metadata = { title: "Article" };

export default async function PostEditor({ params, searchParams }: PageProps<"/admin/content/blog/[id]">) {
  const user = await requireStaff("cms.manage");
  const [{ id }, sp, t] = await Promise.all([params, searchParams, getTranslations("Admin.content")]);
  const post = id === "new" ? null : await db.blogPost.findUnique({ where: { id } });
  if (id !== "new" && !post) notFound();

  return (
    <>
      <PageHeader title={post?.title ?? t("newPost")}>
        {post?.publishedAt && (
          <a href={localePath(`/blog/${post.slug}`, post.locale)} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center rounded-lg border-2 border-border px-4 font-semibold hover:bg-muted">{t("view")}</a>
        )}
      </PageHeader>
      <p className="mb-4"><Link href="/admin/content?tab=blog" className="font-semibold underline underline-offset-4">← {t("tabs.blog")}</Link></p>
      {sp.saved && <p role="status" className="mb-4 rounded-lg bg-muted p-3 font-semibold">{t("saved")}</p>}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Panel>
          <FieldsForm
            key={post?.id ?? "new"}
            action={savePostAction}
            hidden={post ? { id: post.id } : {}}
            fields={[
              { name: "title", label: t("pageTitle"), required: true, wide: true, defaultValue: post?.title },
              { name: "slug", label: t("slug"), required: true, defaultValue: post?.slug, help: t("slugHelp") },
              { name: "locale", label: t("language"), type: "select", defaultValue: post?.locale ?? "sq", options: ["sq", "en", "de"].map((l) => ({ value: l, label: l.toUpperCase() })) },
              { name: "excerpt", label: t("excerpt"), type: "textarea", wide: true, rows: 2, defaultValue: post?.excerpt },
              { name: "body", label: t("pageBody"), type: "textarea", wide: true, rows: 24, required: true, defaultValue: post?.body },
              { name: "authorName", label: t("author"), defaultValue: post?.authorName ?? user.name },
              { name: "publishedAt", label: t("publishAt"), type: "datetime-local", defaultValue: post?.publishedAt ? toBusinessLocal(post.publishedAt) : "", help: t("publishAtHelp") },
            ]}
            submitLabel={t("save")}
            errors={{ duplicate: t("duplicate") }}
          />
        </Panel>
        {post && (
          <Panel title={t("dangerZone")}>
            <ConfirmButton action={deletePostAction} hidden={{ id: post.id }} label={t("delete")} confirm={t("deleteConfirm")} variant="emergency" />
          </Panel>
        )}
      </div>
    </>
  );
}
