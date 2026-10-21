import { routing } from "@/i18n/routing";
import { localePath, siteUrl } from "@/lib/seo";

export type TrackStatus = "DRAFT" | "RECEIVED" | "CONFIRMED" | "DRIVER_EN_ROUTE" | "PICKED_UP" | "IN_TRANSIT" | "DELIVERED" | "COMPLETED" | "CANCELLED";
export type TrackStep = { key: "RECEIVED" | "CONFIRMED" | "DRIVER_EN_ROUTE" | "PICKED_UP" | "IN_TRANSIT" | "DELIVERED"; state: "done" | "current" | "todo" };

export const TOKEN_RE = /^[a-f0-9]{64}$/;

/** Public link to an order's tracking page, in the customer's language. */
export function trackUrl(token: string, locale: string | null | undefined): string {
  const l = (routing.locales as readonly string[]).includes(locale ?? "") ? locale! : routing.defaultLocale;
  return `${siteUrl()}${localePath(`/track/${token}`, l)}`;
}

/**
 * The customer's view of progress. Roadside help has no transport leg, so it
 * skips "in transit". A cancelled order has no current step.
 */
export function trackingSteps(status: TrackStatus, service: string): TrackStep[] {
  const keys: TrackStep["key"][] =
    service === "ROADSIDE_ASSISTANCE"
      ? ["RECEIVED", "CONFIRMED", "DRIVER_EN_ROUTE", "PICKED_UP", "DELIVERED"]
      : ["RECEIVED", "CONFIRMED", "DRIVER_EN_ROUTE", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];
  if (status === "CANCELLED") return keys.map((key) => ({ key, state: "todo" }));
  const at = status === "DRAFT" ? "RECEIVED" : status === "COMPLETED" ? "DELIVERED" : status;
  const idx = keys.indexOf(at);
  return keys.map((key, i) => ({ key, state: i < idx || (i === idx && at === "DELIVERED") ? "done" : i === idx ? "current" : "todo" }));
}
