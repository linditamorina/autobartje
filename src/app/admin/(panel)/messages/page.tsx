import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { Button } from "@/components/ui/button";
import { PageHeader, fmtDateTime } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { retryMessageAction } from "./actions";

export const metadata = { title: "Messages" };

const STATUSES = ["PENDING", "SENT", "FAILED", "SKIPPED"] as const;
const STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  SENT: "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100",
  FAILED: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
  SKIPPED: "bg-muted text-muted-foreground",
};

/** Masks the middle of a phone number or email: staff see who, not the full contact. */
function mask(to: string) {
  if (to.includes("@")) return to.replace(/^(.).*(@.*)$/, "$1…$2");
  return to.length > 6 ? `${to.slice(0, 5)}…${to.slice(-3)}` : to;
}

export default async function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  await requireStaff("settings.manage");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const [t, locale, rows, counts] = await Promise.all([
    getTranslations("Admin.messages"),
    getLocale(),
    db.notificationOutbox.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 100 }),
    db.notificationOutbox.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const orderIds = [...new Set(rows.map((r) => r.orderId).filter(Boolean))] as string[];
  const orders = new Map((await db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, number: true } })).map((o) => [o.id, o.number]));

  return (
    <>
      <PageHeader title={t("title")} />
      <p className="mb-4 text-sm text-muted-foreground">{t("intro")}</p>
      <nav className="mb-4 flex flex-wrap gap-2" aria-label={t("title")}>
        <Link href="?" className={cn("rounded-full border-2 px-3 py-1 text-sm font-semibold", !status ? "border-primary" : "border-border")}>{t("all")}</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`?status=${s}`} className={cn("rounded-full border-2 px-3 py-1 text-sm font-semibold", status === s ? "border-primary" : "border-border")}>
            {t(`status.${s}`)} ({count(s)})
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-1 p-3 text-sm md:grid-cols-[9rem_1fr_auto] md:items-center">
              <time className="text-muted-foreground" dateTime={r.createdAt.toISOString()}>{fmtDateTime(r.createdAt, locale)}</time>
              <div className="min-w-0">
                <span className={cn("mr-2 inline-flex rounded-full px-2 py-0.5 text-xs font-bold", STYLE[r.status])}>{t(`status.${r.status}`)}</span>
                <span className="font-semibold">{t(`events.${r.event}` as never)}</span> · {r.channel} · {mask(r.to)}
                {r.orderId && orders.get(r.orderId) && (
                  <> · <Link href={`/admin/orders/${r.orderId}`} className="underline">{orders.get(r.orderId)}</Link></>
                )}
                {r.lastError && <p className="break-words text-xs text-destructive">{r.lastError}</p>}
                {r.status === "PENDING" && r.sendAfter > r.createdAt && <p className="text-xs text-muted-foreground">{t("scheduled", { time: fmtDateTime(r.sendAfter, locale) })}</p>}
              </div>
              {r.status === "FAILED" && (
                <form action={retryMessageAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <Button type="submit" variant="outline" size="sm">{t("retry")}</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
