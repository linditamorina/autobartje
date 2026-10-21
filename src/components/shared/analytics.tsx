"use client";

import { useEffect } from "react";
import { CONSENT_CHANGED_EVENT, readConsent } from "./consent-banner";
import type { CookieConsent } from "@/lib/consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/**
 * Loads Google Analytics / Ads only after consent, and forwards conversion
 * events from any element with `data-track="<event>"` (call_click,
 * whatsapp_click, quote_shown, booking_submitted).
 */
export function Analytics() {
  useEffect(() => {
    let loaded = false;
    const load = (c: CookieConsent | null) => {
      if (!GA_ID || loaded || !c?.analytics) return;
      loaded = true;
      window.dataLayer = window.dataLayer ?? [];
      window.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments);
      };
      window.gtag("consent", "default", { ad_storage: c.marketing ? "granted" : "denied", analytics_storage: "granted" });
      window.gtag("js", new Date());
      window.gtag("config", GA_ID, { anonymize_ip: true });
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      document.head.appendChild(s);
    };
    load(readConsent());
    const onChange = (e: Event) => load((e as CustomEvent<CookieConsent>).detail);
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-track]");
      if (el) trackEvent(el.dataset.track!);
    };
    window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, []);
  return null;
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (readConsent()?.analytics && window.gtag) window.gtag("event", name, params);
}
