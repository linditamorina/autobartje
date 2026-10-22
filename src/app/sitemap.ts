import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { SERVICE_SLUGS } from "@/content/types";
import { alternates, localePath, siteUrl } from "@/lib/seo";
import { getAreas, getPosts } from "@/server/content";

// Rebuilt hourly so new city pages and blog posts show up.
export const revalidate = 3600;

const PATHS = [
  "/",
  "/quote",
  "/services",
  ...SERVICE_SLUGS.map((s) => `/services/${s}`),
  "/import-guide",
  "/pricing",
  "/fleet",
  "/areas",
  "/faq",
  "/about",
  "/contact",
  "/blog",
  "/legal/terms",
  "/legal/privacy",
  "/legal/cookies",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const translated = (path: string, priority: number) =>
    routing.locales.map((locale) => {
      const { languages } = alternates(path, locale);
      return {
        url: `${base}${localePath(path, locale)}`,
        changeFrequency: "weekly" as const,
        priority,
        alternates: { languages: Object.fromEntries(Object.entries(languages).map(([l, p]) => [l, `${base}${p}`])) },
      };
    });

  const areas = await getAreas(routing.defaultLocale);
  // Blog posts are written per language: one entry each, no alternates.
  const posts = (await Promise.all(routing.locales.map(async (locale) => (await getPosts(locale)).map((p) => ({ ...p, locale }))))).flat();

  return [
    ...PATHS.flatMap((path) => translated(path, path === "/" ? 1 : path.startsWith("/legal") ? 0.3 : 0.7)),
    ...areas.flatMap((a) => translated(`/areas/${a.slug}`, 0.6)),
    ...posts.map((p) => ({ url: `${base}${localePath(`/blog/${p.slug}`, p.locale)}`, lastModified: new Date(p.updatedAt), changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
