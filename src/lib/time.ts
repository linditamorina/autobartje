/** Business time zone: Kosovo uses Central European Time. */
export const BUSINESS_TZ = "Europe/Belgrade";

function zoneParts(d: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

/** Zone offset (ms ahead of UTC) at instant `d`. */
function offsetAt(d: Date): number {
  const p = zoneParts(d);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d.getTime() / 1000) * 1000;
}

/** Midnight of the current business day, as a UTC instant. */
export function startOfBusinessDay(now = new Date()): Date {
  const p = zoneParts(now);
  const midnightAsUtc = Date.UTC(p.year, p.month - 1, p.day);
  // The offset at midnight can differ from the offset now on clock-change days.
  const guess = midnightAsUtc - offsetAt(now);
  return new Date(midnightAsUtc - offsetAt(new Date(guess)));
}

export function daysFromNow(days: number, now = new Date()): Date {
  return new Date(now.getTime() + days * 86_400_000);
}

/** "YYYY-MM-DD" of the business day containing `d`. */
export function businessDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** [start, end) instants of a business day given as "YYYY-MM-DD" (23 or 25 hours on DST days). */
export function businessDayRange(date: string): { start: Date; end: Date } {
  const start = startOfBusinessDay(new Date(`${date}T12:00:00Z`));
  return { start, end: startOfBusinessDay(new Date(start.getTime() + 36 * 3_600_000)) };
}

/** "YYYY-MM-DDTHH:mm" in business time, for <input type="datetime-local">. */
export function toBusinessLocal(d: Date): string {
  const p = zoneParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Parses a datetime-local value as business time. Returns null for malformed input. */
export function fromBusinessLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const guess = asUtc - offsetAt(new Date(asUtc));
  return new Date(asUtc - offsetAt(new Date(guess)));
}

/** Now, rounded up to the next `minutes` boundary (default quarter hour). */
export function roundedNow(minutes = 15): Date {
  const step = minutes * 60_000;
  return new Date(Math.ceil(Date.now() / step) * step);
}

/** "2 min ago" / "just now" in the given language, for live positions. */
export function minutesAgo(d: Date, locale: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - d.getTime()) / 60_000));
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-min, "minute");
}
