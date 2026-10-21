"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatEur } from "@/lib/money";
import type { QuoteResult } from "@/server/pricing/quote";

export function PriceBox({ quote, vatRateBp = 1800 }: { quote: QuoteResult; vatRateBp?: number }) {
  const t = useTranslations("Quote");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const fmt = (c: number) => formatEur(c, locale === "sq" ? "sq-XK" : locale);

  if (!quote.available) {
    return (
      <div role="status" className="rounded-xl border-2 border-border bg-muted p-4">
        <p className="font-semibold">{quote.reason === "no_coordinates" ? t("noCoordinates") : t("noPrice")}</p>
      </div>
    );
  }

  return (
    <section role="status" aria-live="polite" className="rounded-xl border-2 border-primary bg-card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("estimate")}</h2>
      <p className="text-4xl font-extrabold" data-testid="quote-total">
        {fmt(quote.totalCents)}
      </p>
      <p className="text-sm text-muted-foreground">{t("inclVat", { rate: vatRateBp / 100 })}</p>
      {quote.distanceKm != null && (
        <p className="mt-1 text-sm">{quote.distanceSource === "google" ? t("distance", { km: quote.distanceKm }) : t("distanceApprox", { km: quote.distanceKm })}</p>
      )}
      {quote.transitDays != null && <p className="mt-1 text-sm">{t("transitDays", { days: quote.transitDays })}</p>}
      <details className="mt-3">
        <summary className="min-h-10 cursor-pointer font-semibold">{t("net")} / {t("vat")}</summary>
        <dl className="mt-2 space-y-1 text-sm">
          {quote.lines.map((l) => (
            <div key={l.key} className="flex justify-between gap-4">
              <dt>{l.label}</dt>
              <dd className="tabular-nums">{fmt(l.cents)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-border pt-1 font-semibold">
            <dt>{t("net")}</dt>
            <dd className="tabular-nums">{fmt(quote.netCents)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>{t("vat")}</dt>
            <dd className="tabular-nums">{fmt(quote.vatCents)}</dd>
          </div>
        </dl>
      </details>
      <p className="mt-3 text-sm font-semibold">{tc("finalPriceNote")}</p>
    </section>
  );
}
