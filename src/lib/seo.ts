import { routing, type AppLocale } from "@/i18n/routing";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Path for a locale with the "as-needed" prefix strategy (default locale has no prefix). */
export function localePath(path: string, locale: string): string {
  const clean = path === "/" ? "" : path;
  return locale === routing.defaultLocale ? clean || "/" : `/${locale}${clean}`;
}

/** Canonical + hreflang alternates for a page. */
export function alternates(path: string, locale: string) {
  const languages: Record<string, string> = {};
  for (const l of routing.locales as readonly AppLocale[]) languages[l] = localePath(path, l);
  languages["x-default"] = localePath(path, routing.defaultLocale);
  return { canonical: localePath(path, locale), languages };
}
