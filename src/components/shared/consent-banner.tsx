"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { CONSENT_COOKIE, CONSENT_POLICY_VERSION, parseConsent, serializeConsent, type CookieConsent } from "@/lib/consent";

const OPEN_EVENT = "ab:open-consent";
export const CONSENT_CHANGED_EVENT = "ab:consent-changed";

function rawConsentCookie(): string {
  return document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`))?.split("=")[1] ?? "";
}

export function readConsent(): CookieConsent | null {
  if (typeof document === "undefined") return null;
  return parseConsent(rawConsentCookie());
}

function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
}

const SERVER = "server";

function saveConsent(analytics: boolean, marketing: boolean) {
  const c: CookieConsent = { analytics, marketing, version: CONSENT_POLICY_VERSION };
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(serializeConsent(c))}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: c }));
  // Proof of consent (GDPR art. 7(1)); failures must not block the visitor.
  fetch("/api/consent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c), keepalive: true }).catch(() => {});
}

/**
 * Cookie banner. "Reject" is as prominent as "Accept" (same size and style),
 * and nothing non-essential loads before a choice is made.
 */
export function ConsentBanner() {
  const t = useTranslations("Consent");
  // Never rendered on the server, so the banner can't flash for visitors who already chose.
  const raw = useSyncExternalStore(subscribe, rawConsentCookie, () => SERVER);
  const [reopened, setReopened] = useState(false);
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const reopen = () => {
      const c = readConsent();
      setAnalytics(c?.analytics ?? false);
      setMarketing(c?.marketing ?? false);
      setCustom(true);
      setReopened(true);
    };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  const open = reopened || (raw !== SERVER && !parseConsent(raw));
  if (!open) return null;

  const choose = (a: boolean, m: boolean) => {
    saveConsent(a, m);
    setReopened(false);
  };

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-2 bottom-[calc(80px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-2xl rounded-xl border-2 border-border bg-card p-4 text-card-foreground shadow-2xl md:bottom-4"
    >
      <h2 id="consent-title" className="text-lg font-bold">{t("title")}</h2>
      <p className="mt-1 text-sm">
        {t("text")}{" "}
        <Link href="/legal/cookies" className="font-semibold underline underline-offset-4">{t("more")}</Link>
      </p>
      {custom && (
        <fieldset className="mt-3 space-y-2 text-sm">
          <label className="flex min-h-10 items-center gap-3 opacity-80">
            <input type="checkbox" checked disabled className="size-5" /> {t("necessary")}
          </label>
          <label className="flex min-h-10 items-center gap-3">
            <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="size-5" /> {t("analytics")}
          </label>
          <label className="flex min-h-10 items-center gap-3">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="size-5" /> {t("marketing")}
          </label>
        </fieldset>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button variant="outline" onClick={() => choose(false, false)}>{t("reject")}</Button>
        <Button variant="outline" onClick={() => choose(true, true)}>{t("accept")}</Button>
        {custom ? (
          <Button variant="secondary" className="col-span-2 sm:col-span-1" onClick={() => choose(analytics, marketing)}>{t("save")}</Button>
        ) : (
          <Button variant="secondary" className="col-span-2 sm:col-span-1" onClick={() => setCustom(true)}>{t("customize")}</Button>
        )}
      </div>
    </section>
  );
}

export function CookieSettingsLink({ label }: { label: string }) {
  return (
    <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      {label}
    </button>
  );
}
