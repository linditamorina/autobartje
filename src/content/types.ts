import type { SERVICES } from "@/lib/validation/booking";

/** Editable public pages. Defaults ship with the code; admin edits are stored in ContentPage. */
export const PAGE_SLUGS = [
  "services/emergency-towing",
  "services/roadside-assistance",
  "services/car-transport",
  "services/car-import",
  "import-guide",
  "about",
  "legal/terms",
  "legal/privacy",
  "legal/cookies",
] as const;

export type PageSlug = (typeof PAGE_SLUGS)[number];
export type PageCopy = { title: string; description: string; body: string };
export type PageSet = Record<PageSlug, PageCopy>;

export const SERVICE_SLUGS = ["emergency-towing", "roadside-assistance", "car-transport", "car-import"] as const;
export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

/** Booking/quote service code for each service page. */
export const SERVICE_CODE: Record<ServiceSlug, (typeof SERVICES)[number]> = {
  "emergency-towing": "EMERGENCY_TOWING",
  "roadside-assistance": "ROADSIDE_ASSISTANCE",
  "car-transport": "DOMESTIC_TRANSPORT",
  "car-import": "INTERNATIONAL_TRANSPORT",
};

export function isPageSlug(s: string): s is PageSlug {
  return (PAGE_SLUGS as readonly string[]).includes(s);
}
