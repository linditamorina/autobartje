/** Business time zone: Kosovo uses Central European Time. */
export const BUSINESS_TZ = "Europe/Belgrade";

/** Midnight of the current business day, as a UTC instant. */
export function startOfBusinessDay(now = new Date()): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, Number(p.value)]),
  );
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offsetMs = localAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - offsetMs);
}

export function daysFromNow(days: number, now = new Date()): Date {
  return new Date(now.getTime() + days * 86_400_000);
}
