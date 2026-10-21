import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { PageHeader, fmtDateTime } from "@/components/admin/ui";

export const metadata = { title: "Audit log" };

const PAGE_SIZE = 50;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Compact "key: before → after" lines for the changed fields. */
function diffLines(before: unknown, after: unknown): string[] {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const show = (v: unknown) => (v === undefined ? "–" : typeof v === "string" ? v : JSON.stringify(v));
  return [...new Set([...Object.keys(b), ...Object.keys(a)])].map((k) => `${k}: ${show(b[k])} → ${show(a[k])}`);
}

function entityHref(type: string, id: string): string | null {
  if (type === "Order") return `/admin/orders/${id}`;
  return null;
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireStaff("audit.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const entity = str(sp.entity);
  const where = entity ? { entityType: entity } : {};
  const [t, tc, locale, rows, total, types] = await Promise.all([
    getTranslations("Admin.audit"),
    getTranslations("Admin.common"),
    getLocale(),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { actor: { select: { name: true, email: true } } } }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => `?${new URLSearchParams({ ...(entity ? { entity } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title={t("title")} />
      <form className="mb-4 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="entity">{t("entity")}</label>
        <select id="entity" name="entity" defaultValue={entity ?? ""} className="min-h-12 rounded-lg border-2 border-input bg-background px-3">
          <option value="">{t("allEntities")}</option>
          {types.map((x) => <option key={x.entityType} value={x.entityType}>{x.entityType}</option>)}
        </select>
        <button type="submit" className="min-h-12 rounded-lg bg-secondary px-4 font-semibold text-secondary-foreground">{t("filter")}</button>
      </form>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((r) => {
            const href = entityHref(r.entityType, r.entityId);
            return (
              <li key={r.id} className="grid gap-1 p-3 text-sm md:grid-cols-[10rem_12rem_1fr]">
                <time dateTime={r.createdAt.toISOString()} className="text-muted-foreground">{fmtDateTime(r.createdAt, locale)}</time>
                <span className="font-semibold">{r.actor?.name ?? r.actor?.email ?? t("system")}</span>
                <div className="min-w-0">
                  <p>
                    <code className="font-semibold">{r.action}</code> · {r.entityType}{" "}
                    {href ? <Link href={href} className="underline">{r.entityId}</Link> : <span className="break-all">{r.entityId}</span>}
                    {r.ip && <span className="text-muted-foreground"> · {r.ip}</span>}
                  </p>
                  <ul className="mt-1 space-y-0.5 break-words text-xs text-muted-foreground">
                    {diffLines(r.before, r.after).slice(0, 12).map((line) => <li key={line}>{line}</li>)}
                  </ul>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <nav className="mt-4 flex items-center justify-between gap-2" aria-label={tc("page", { page })}>
        {page > 1 ? <Link href={qs(page - 1)} className="font-semibold underline">{tc("previous")}</Link> : <span />}
        <span className="text-sm text-muted-foreground">{tc("page", { page })} / {pages}</span>
        {page < pages ? <Link href={qs(page + 1)} className="font-semibold underline">{tc("next")}</Link> : <span />}
      </nav>
    </>
  );
}
