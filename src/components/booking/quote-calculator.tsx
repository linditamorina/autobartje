"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getQuote } from "@/app/[locale]/quote/actions";
import { formatPhone, telHref } from "@/lib/contact";
import { trackEvent } from "@/components/shared/analytics";
import type { QuoteResult } from "@/server/pricing/quote";
import { emptyDraft, loadDraft, saveDraft, toQuoteInput, type Draft } from "./draft";
import { PriceBox } from "./price-box";
import { QuoteFields, TimeFields, type DraftErrors } from "./quote-fields";
import { validateStep } from "./validate";

export function QuoteCalculator({ phone, vatRateBp, initialService }: { phone: string; vatRateBp: number; initialService?: Draft["service"] }) {
  const t = useTranslations("Quote");
  const tb = useTranslations("Booking.errors");
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => {
    const d = (typeof window !== "undefined" && loadDraft()) || emptyDraft();
    return initialService ? { ...d, service: initialService, isAsap: initialService !== "DOMESTIC_TRANSPORT" && initialService !== "INTERNATIONAL_TRANSPORT" } : d;
  });
  const [errors, setErrors] = useState<DraftErrors>({});
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => {
      const next = { ...d, ...patch, quoteId: null };
      saveDraft(next);
      return next;
    });
    setQuote(null);
  };

  function calculate(e: React.FormEvent) {
    e.preventDefault();
    const errs = { ...validateStep(draft, 1), ...validateStep(draft, 3) };
    setErrors(Object.fromEntries(Object.entries(errs).map(([k, v]) => [k, tb(v as never)])));
    if (Object.keys(errs).length) return;
    setFailure(null);
    start(async () => {
      const res = await getQuote(toQuoteInput(draft));
      if (!res.ok) {
        setFailure(res.error === "rate_limited" ? t("rateLimited") : t("error"));
        return;
      }
      setQuote(res.quote);
      trackEvent("quote_shown", { value: res.quote.totalCents / 100, currency: "EUR", service: draft.service });
      setDraft((d) => {
        const next = { ...d, quoteId: res.quote.quoteId };
        saveDraft(next);
        return next;
      });
    });
  }

  function book() {
    saveDraft({ ...draft, step: 2 });
    router.push("/book");
  }

  return (
    <form onSubmit={calculate} noValidate className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <QuoteFields draft={draft} update={update} errors={errors} />
        <TimeFields draft={draft} update={update} errors={errors} />
      </div>
      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
          {pending ? t("calculating") : t("calculate")}
        </Button>
        {failure && (
          <p role="alert" className="font-semibold text-destructive">
            {failure}
          </p>
        )}
        {quote && <PriceBox quote={quote} vatRateBp={vatRateBp} />}
        {quote && (
          <Button type="button" variant="emergency" size="lg" className="w-full" onClick={book}>
            {t("bookNow")} <ArrowRight aria-hidden />
          </Button>
        )}
        <p className="text-center text-sm">
          {t("callInstead")}:{" "}
          <a href={telHref(phone)} className="inline-flex items-center gap-1 font-bold underline underline-offset-4" data-track="call_click">
            <Phone aria-hidden className="size-4" /> {formatPhone(phone)}
          </a>
        </p>
      </div>
    </form>
  );
}
