import { BUSINESS_TZ, businessDate, businessDayRange } from "@/lib/time";

/**
 * Report maths as pure functions over plain rows, so every number on the
 * reports page is unit tested. Loading the rows is in ./queries.ts.
 */

export type ReportOrder = {
  createdAt: Date;
  status: string;
  service: string;
  channel: string;
  leadSource: string | null;
  priority: string;
  isAsap: boolean;
  companyId: string | null;
  valueCents: number | null; // final price, else the estimate
  distanceKm: number | null;
  events: { to: string; at: Date }[];
  driver: { id: string; name: string } | null;
};
export type ReportInvoice = { issueDate: Date; subtotalCents: number; totalCents: number };
export type ReportPayment = { method: string; amountCents: number };
export type ReportQuote = { converted: boolean };

export const DONE = ["DELIVERED", "COMPLETED"];
const URGENT_SERVICES = ["EMERGENCY_TOWING", "ROADSIDE_ASSISTANCE"];

export type PeriodKey = "month" | "lastMonth" | "30d" | "year" | "custom";
export type Period = { key: PeriodKey; from: Date; to: Date; fromDate: string; toDate: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** The period picked on the page; dates are business days, `toDate` inclusive. Defaults to this month. */
export function periodFrom(sp: { period?: string; from?: string; to?: string }, now = new Date()): Period {
  const today = businessDate(now);
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  let key = (["month", "lastMonth", "30d", "year", "custom"] as const).find((k) => k === sp.period) ?? "month";
  let fromDate: string;
  let toDate = today;
  if (key === "custom" && sp.from && sp.to && DATE_RE.test(sp.from) && DATE_RE.test(sp.to) && sp.from <= sp.to) {
    fromDate = sp.from;
    toDate = sp.to;
  } else {
    if (key === "custom") key = "month";
    if (key === "lastMonth") {
      const ly = m === 1 ? y - 1 : y;
      const lm = m === 1 ? 12 : m - 1;
      fromDate = `${ly}-${pad(lm)}-01`;
      toDate = addDays(`${y}-${pad(m)}-01`, -1);
    } else if (key === "30d") fromDate = addDays(today, -29);
    else if (key === "year") fromDate = `${y}-01-01`;
    else fromDate = `${y}-${pad(m)}-01`;
  }
  return { key, fromDate, toDate, from: businessDayRange(fromDate).start, to: businessDayRange(toDate).end };
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

const firstAt = (o: ReportOrder, to: string) => o.events.find((e) => e.to === to)?.at ?? null;
const minutesBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60_000);

/** Minutes from the call or booking until the truck was at the customer, for urgent call-outs. */
export function arrivalMinutes(o: ReportOrder): number | null {
  if (!o.isAsap || !URGENT_SERVICES.includes(o.service)) return null;
  const at = firstAt(o, "PICKED_UP");
  if (!at) return null;
  const m = minutesBetween(o.createdAt, at);
  // A negative or multi-day gap is a back-filled order, not a response time.
  return m >= 0 && m <= 24 * 60 ? m : null;
}

export function summary(orders: ReportOrder[], invoices: ReportInvoice[], quotes: ReportQuote[]) {
  const real = orders.filter((o) => o.status !== "DRAFT");
  const done = real.filter((o) => DONE.includes(o.status));
  const cancelled = real.filter((o) => o.status === "CANCELLED");
  const valued = done.filter((o) => o.valueCents != null);
  const doneValue = valued.reduce((s, o) => s + o.valueCents!, 0);
  const arrivals = real.map(arrivalMinutes).filter((m): m is number => m != null);
  const confirms = real
    .map((o) => {
      const at = firstAt(o, "CONFIRMED");
      return at ? minutesBetween(o.createdAt, at) : null;
    })
    .filter((m): m is number => m != null && m >= 0);
  return {
    orders: real.length,
    done: done.length,
    cancelled: cancelled.length,
    cancelRate: real.length ? cancelled.length / real.length : null,
    b2b: real.filter((o) => o.companyId).length,
    doneValueCents: doneValue,
    avgOrderCents: valued.length ? Math.round(doneValue / valued.length) : null,
    invoicedNetCents: invoices.reduce((s, i) => s + i.subtotalCents, 0),
    invoicedGrossCents: invoices.reduce((s, i) => s + i.totalCents, 0),
    quotes: quotes.length,
    quoteConversion: quotes.length ? quotes.filter((q) => q.converted).length / quotes.length : null,
    arrival: { count: arrivals.length, median: median(arrivals), p90: percentile(arrivals, 90) },
    confirmMedian: median(confirms),
  };
}

export type GroupRow = { key: string; orders: number; done: number; valueCents: number };

/** Orders, finished orders and their value per service, channel, lead source... Biggest first. */
export function groupBy(orders: ReportOrder[], keyOf: (o: ReportOrder) => string | null): GroupRow[] {
  const rows = new Map<string, GroupRow>();
  for (const o of orders) {
    if (o.status === "DRAFT") continue;
    const key = keyOf(o) ?? "";
    const r = rows.get(key) ?? { key, orders: 0, done: 0, valueCents: 0 };
    r.orders++;
    if (DONE.includes(o.status)) {
      r.done++;
      r.valueCents += o.valueCents ?? 0;
    }
    rows.set(key, r);
  }
  return [...rows.values()].sort((a, b) => b.orders - a.orders || b.valueCents - a.valueCents || a.key.localeCompare(b.key));
}

export type DriverRow = { id: string; name: string; jobs: number; km: number; valueCents: number; arrivalMedian: number | null };

/** Finished jobs per driver, with distance, value and their median arrival time on urgent call-outs. */
export function driverStats(orders: ReportOrder[]): DriverRow[] {
  const rows = new Map<string, DriverRow & { arrivals: number[] }>();
  for (const o of orders) {
    if (!o.driver || !DONE.includes(o.status)) continue;
    const r = rows.get(o.driver.id) ?? { id: o.driver.id, name: o.driver.name, jobs: 0, km: 0, valueCents: 0, arrivalMedian: null, arrivals: [] };
    r.jobs++;
    r.km += o.distanceKm ?? 0;
    r.valueCents += o.valueCents ?? 0;
    const a = arrivalMinutes(o);
    if (a != null) r.arrivals.push(a);
    rows.set(o.driver.id, r);
  }
  return [...rows.values()]
    .map(({ arrivals, ...r }) => ({ ...r, km: Math.round(r.km), arrivalMedian: median(arrivals) }))
    .sort((a, b) => b.jobs - a.jobs || a.name.localeCompare(b.name));
}

const weekdayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TZ, weekday: "short", hour: "2-digit", hourCycle: "h23" });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Orders per weekday (0 = Monday) and hour, in business time. */
export function heatmap(orders: ReportOrder[]): number[][] {
  const grid = WEEKDAYS.map(() => Array<number>(24).fill(0));
  for (const o of orders) {
    if (o.status === "DRAFT") continue;
    const parts = Object.fromEntries(weekdayFmt.formatToParts(o.createdAt).map((p) => [p.type, p.value]));
    grid[WEEKDAYS.indexOf(parts.weekday)][Number(parts.hour)]++;
  }
  return grid;
}

/** Invoiced amounts per business month for the 12 months up to and including `now`'s month. Credit notes count negative. */
export function monthlyInvoiced(invoices: ReportInvoice[], now = new Date()): { month: string; netCents: number; grossCents: number }[] {
  const [y, m] = businessDate(now).split("-").map(Number);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 12 + i, 1));
    return d.toISOString().slice(0, 7);
  });
  const sums = new Map(months.map((k) => [k, { month: k, netCents: 0, grossCents: 0 }]));
  for (const inv of invoices) {
    const r = sums.get(businessDate(inv.issueDate).slice(0, 7));
    if (!r) continue;
    r.netCents += inv.subtotalCents;
    r.grossCents += inv.totalCents;
  }
  return months.map((k) => sums.get(k)!);
}

export function paymentsByMethod(payments: ReportPayment[]): { method: string; count: number; cents: number }[] {
  const rows = new Map<string, { method: string; count: number; cents: number }>();
  for (const p of payments) {
    const r = rows.get(p.method) ?? { method: p.method, count: 0, cents: 0 };
    r.count++;
    r.cents += p.amountCents;
    rows.set(p.method, r);
  }
  return [...rows.values()].sort((a, b) => b.cents - a.cents);
}
