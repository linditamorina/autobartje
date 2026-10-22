import { cn } from "@/lib/utils";
import { BUSINESS_TZ } from "@/lib/time";

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  RECEIVED: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  CONFIRMED: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100",
  DRIVER_EN_ROUTE: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100",
  PICKED_UP: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
  IN_TRANSIT: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
  DELIVERED: "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100",
  COMPLETED: "bg-green-200 text-green-950 dark:bg-green-900/60 dark:text-green-50",
  CANCELLED: "bg-zinc-200 text-zinc-800 line-through dark:bg-zinc-800 dark:text-zinc-200",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_STYLE[status])}>{label}</span>;
}

export function UrgentBadge({ label }: { label: string }) {
  return <span className="inline-flex rounded-full bg-emergency px-2 py-0.5 text-xs font-bold text-emergency-foreground">{label}</span>;
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-extrabold md:text-3xl">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Panel({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-4 text-card-foreground", className)}>
      {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
      {children}
    </section>
  );
}

const TZ = BUSINESS_TZ;

export function fmtDateTime(d: Date | null | undefined, locale: string): string {
  if (!d) return "–";
  return new Intl.DateTimeFormat(locale, { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(d);
}

export function fmtDate(d: Date | null | undefined, locale: string): string {
  if (!d) return "–";
  return new Intl.DateTimeFormat(locale, { timeZone: TZ, dateStyle: "medium" }).format(d);
}

export const INVOICE_STYLE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ISSUED: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100",
  PARTIALLY_PAID: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  OVERDUE: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
  PAID: "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100",
  VOID: "bg-zinc-200 text-zinc-800 line-through dark:bg-zinc-800 dark:text-zinc-200",
};
