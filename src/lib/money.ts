/** All money is handled as integer euro cents. */

export const VAT_RATE_BP = 1800; // 18.00 %, Kosovo standard rate

/** Percentage of an amount expressed in basis points (1 bp = 0.01 %), rounded half away from zero. */
export function applyBp(cents: number, bp: number): number {
  const raw = (cents * bp) / 10_000;
  return Math.sign(raw) * Math.round(Math.abs(raw));
}

export function vatOf(netCents: number, rateBp = VAT_RATE_BP): number {
  return applyBp(netCents, rateBp);
}

export function formatEur(cents: number, locale = "sq-XK"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function eurToCents(eur: number): number {
  return Math.round(eur * 100);
}
