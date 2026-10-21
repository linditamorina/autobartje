"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getQuote } from "@/app/[locale]/quote/actions";
import { submitBooking } from "@/app/[locale]/book/actions";
import { trackEvent } from "@/components/shared/analytics";
import { cn } from "@/lib/utils";
import type { QuoteResult } from "@/server/pricing/quote";
import { clearDraft, emptyDraft, loadDraft, saveDraft, toBookingInput, toQuoteInput, type Draft } from "./draft";
import { CheckField, ChoiceGroup, TextField } from "./fields";
import { PhotoUpload } from "./photo-upload";
import { PriceBox } from "./price-box";
import { QuoteFields, TimeFields, type DraftErrors } from "./quote-fields";
import { Turnstile, turnstileEnabled } from "./turnstile";
import { validateStep } from "./validate";

const STEPS = ["service", "vehicle", "time", "contact", "summary"] as const;
const CHANNELS = ["PHONE", "WHATSAPP", "SMS", "EMAIL"] as const;

export function BookingWizard({ vatRateBp }: { vatRateBp: number }) {
  const t = useTranslations("Booking");
  const locale = useLocale() as "sq" | "en" | "de";
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => loadDraft() ?? emptyDraft());
  const [errors, setErrors] = useState<DraftErrors>({});
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  // A ref, not state: submit may need to wait for the bot check to finish.
  const token = useRef<string | null>(null);
  const onToken = useCallback((value: string | null) => {
    token.current = value;
  }, []);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const step = Math.min(Math.max(draft.step, 1), STEPS.length);

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft((d) => {
      const next = { ...d, ...patch };
      saveDraft(next);
      return next;
    });
  }, []);

  const tErr = (code?: string) => (code ? t(`errors.${code}` as never) : undefined);
  const translated = Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, tErr(v)]));

  // Price the booking when the summary opens.
  useEffect(() => {
    if (step !== STEPS.length) return;
    let active = true;
    getQuote(toQuoteInput(draft)).then((res) => {
      if (active && res.ok) setQuote(res.quote);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function go(to: number) {
    update({ step: to });
    setErrors({});
    requestAnimationFrame(() => {
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: "start" });
    });
  }

  function next() {
    const errs = validateStep(draft, step);
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    go(step + 1);
  }

  function submit() {
    const errs = validateStep(draft, 5);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setFailure(null);
    start(async () => {
      const source = new URLSearchParams(window.location.search).get("utm_source") ?? (document.referrer ? new URL(document.referrer).hostname : null);
      // A fast customer can press send before the bot check has answered; give it up to 10 s.
      for (let waited = 0; turnstileEnabled && !token.current && waited < 10_000; waited += 250) {
        await new Promise((r) => setTimeout(r, 250));
      }
      const res = await submitBooking(toBookingInput(draft, locale, token.current, source));
      if (res.ok) {
        trackEvent("booking_submitted", { service: draft.service, value: (quote?.totalCents ?? 0) / 100, currency: "EUR" });
        clearDraft();
        router.push({ pathname: "/book/done", query: { order: res.orderNumber } });
        return;
      }
      setFailure(t(`errors.${res.error === "invalid" ? "server" : res.error}` as never));
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="mb-6 flex gap-1" aria-label={t("stepOf", { step, total: STEPS.length })}>
        {STEPS.map((s, i) => (
          <li key={s} className={cn("h-2 flex-1 rounded-full", i < step ? "bg-primary" : "bg-muted")} aria-current={i + 1 === step ? "step" : undefined}>
            <span className="sr-only">{t(`steps.${s}`)}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm font-semibold text-muted-foreground">{t("stepOf", { step, total: STEPS.length })}</p>
      <h2 ref={heading} tabIndex={-1} className="mb-6 text-2xl font-extrabold focus:outline-none">
        {t(`steps.${STEPS[step - 1]}`)}
      </h2>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS.length) next();
          else submit();
        }}
        className="space-y-6"
      >
        {step === 1 && <QuoteFields draft={draft} update={update} errors={translated} />}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={t("make")} name="make" autoComplete="off" value={draft.vehicle.make} onChange={(e) => update({ vehicle: { ...draft.vehicle, make: e.target.value } })} error={translated.make} required />
              <TextField label={t("model")} name="model" autoComplete="off" value={draft.vehicle.model} onChange={(e) => update({ vehicle: { ...draft.vehicle, model: e.target.value } })} error={translated.model} required />
              <TextField label={t("year")} name="year" inputMode="numeric" maxLength={4} value={draft.vehicle.year} onChange={(e) => update({ vehicle: { ...draft.vehicle, year: e.target.value.replace(/\D/g, "") } })} error={translated.year} />
              <TextField label={t("plate")} name="plate" autoCapitalize="characters" value={draft.vehicle.plate} onChange={(e) => update({ vehicle: { ...draft.vehicle, plate: e.target.value } })} />
            </div>
            <TextField label={t("vin")} name="vin" autoCapitalize="characters" maxLength={17} help={t("vinHelp")} value={draft.vehicle.vin} onChange={(e) => update({ vehicle: { ...draft.vehicle, vin: e.target.value.toUpperCase() } })} error={translated.vin} />
            <TextField label={t("condition")} name="condition" placeholder={t("conditionPlaceholder")} value={draft.vehicle.condition} onChange={(e) => update({ vehicle: { ...draft.vehicle, condition: e.target.value } })} />
            <PhotoUpload keys={draft.vehicle.photoKeys} onChange={(photoKeys) => update({ vehicle: { ...draft.vehicle, photoKeys } })} />
          </div>
        )}

        {step === 3 && <TimeFields draft={draft} update={update} errors={translated} />}

        {step === 4 && (
          <div className="space-y-4">
            <TextField label={t("fullName")} name="name" autoComplete="name" value={draft.contact.fullName} onChange={(e) => update({ contact: { ...draft.contact, fullName: e.target.value } })} error={translated.fullName} required />
            <TextField label={t("phone")} name="tel" type="tel" autoComplete="tel" inputMode="tel" help={t("phoneHelp")} value={draft.contact.phone} onChange={(e) => update({ contact: { ...draft.contact, phone: e.target.value } })} error={translated.phone} required />
            <TextField label={t("email")} name="email" type="email" autoComplete="email" value={draft.contact.email} onChange={(e) => update({ contact: { ...draft.contact, email: e.target.value } })} error={translated.email} />
            <ChoiceGroup
              legend={t("preferredChannel")}
              name="channel"
              value={draft.contact.preferredChannel}
              onChange={(preferredChannel) => update({ contact: { ...draft.contact, preferredChannel } })}
              options={CHANNELS.map((c) => ({ value: c, label: t(`channels.${c}`) }))}
            />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <Summary draft={draft} onEdit={go} />
            {quote && <PriceBox quote={quote} vatRateBp={vatRateBp} />}
            <TextField label={t("notes")} name="notes" value={draft.notes} onChange={(e) => update({ notes: e.target.value })} />
            <div>
              <CheckField checked={draft.consents.terms} onChange={(terms) => update({ consents: { ...draft.consents, terms } })} error={translated.terms}>
                {t.rich("termsConsent", { terms: (c) => <Link href="/legal/terms" target="_blank" className="font-semibold underline underline-offset-4">{c}</Link> })}
              </CheckField>
              <CheckField checked={draft.consents.privacy} onChange={(privacy) => update({ consents: { ...draft.consents, privacy } })} error={translated.privacy}>
                {t.rich("privacyConsent", { privacy: (c) => <Link href="/legal/privacy" target="_blank" className="font-semibold underline underline-offset-4">{c}</Link> })}
              </CheckField>
              <CheckField checked={draft.consents.marketing} onChange={(marketing) => update({ consents: { ...draft.consents, marketing } })} label={t("marketingConsent")} />
            </div>
            <Turnstile onToken={onToken} language={locale} />
          </div>
        )}

        {failure && (
          <p role="alert" className="rounded-lg bg-destructive p-3 font-semibold text-destructive-foreground">
            {failure}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={() => go(step - 1)}>
              <ArrowLeft aria-hidden /> {t("back")}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="lg" variant={step === STEPS.length ? "emergency" : "default"} disabled={pending} aria-busy={pending}>
            {step === STEPS.length ? (
              <>
                <Check aria-hidden /> {pending ? t("submitting") : t("submit")}
              </>
            ) : (
              <>
                {t("next")} <ArrowRight aria-hidden />
              </>
            )}
          </Button>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {t("draftSaved")}{" "}
          <button
            type="button"
            className="font-semibold underline underline-offset-4"
            onClick={() => {
              clearDraft();
              setDraft(emptyDraft());
              setQuote(null);
            }}
          >
            {t("startOver")}
          </button>
        </p>
      </form>
    </div>
  );
}

function Summary({ draft, onEdit }: { draft: Draft; onEdit: (step: number) => void }) {
  const t = useTranslations("Booking");
  const tq = useTranslations("Quote");
  const intl = draft.service === "INTERNATIONAL_TRANSPORT";
  const from = intl ? `${draft.fromCity}, ${tq(`countries.${draft.fromCountry}` as never)}` : draft.pickup?.address;
  const time = intl
    ? `${draft.windowStart.slice(0, 10)}${draft.windowEnd ? ` – ${draft.windowEnd.slice(0, 10)}` : ""}`
    : draft.isAsap
      ? tq("asap")
      : draft.pickupAt.replace("T", " ");
  const rows: [string, React.ReactNode, number][] = [
    [t("summaryRoute"), <>{tq(`services.${draft.service}`)}<br />{from}{draft.dropoff && <> → {draft.dropoff.address}</>}</>, 1],
    [t("summaryVehicle"), <>{[draft.vehicle.make, draft.vehicle.model, draft.vehicle.year].filter(Boolean).join(" ")}{draft.vehicle.plate && ` · ${draft.vehicle.plate}`} · {tq(`vehicleTypes.${draft.vehicleType}`)}</>, 2],
    [t("summaryTime"), time, 3],
    [t("summaryContact"), <>{draft.contact.fullName}<br />{draft.contact.phone}{draft.contact.email && <><br />{draft.contact.email}</>}</>, 4],
  ];
  return (
    <dl className="divide-y divide-border rounded-xl border-2 border-border">
      {rows.map(([label, value, step]) => (
        <div key={label} className="flex items-start justify-between gap-4 p-4">
          <div>
            <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words">{value}</dd>
          </div>
          <button type="button" onClick={() => onEdit(step)} className="min-h-10 shrink-0 font-semibold underline underline-offset-4">
            {t("edit")} <span className="sr-only">{label}</span>
          </button>
        </div>
      ))}
    </dl>
  );
}
