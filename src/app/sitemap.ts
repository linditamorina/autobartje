import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { alternates, localePath, siteUrl } from "@/lib/seo";

/** Static public routes; CMS pages, service areas and blog posts are added in their own PRs. */
const PATHS = ["/", "/quote", "/services", "/import-guide", "/pricing", "/fleet", "/faq", "/about", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PATHS.flatMap((path) =>
    routing.locales.map((locale) => {
      const { languages } = alternates(path, locale);
      return {
        url: `${base}${localePath(path, locale)}`,
        changeFrequency: "weekly" as const,
        priority: path === "/" ? 1 : 0.7,
        alternates: { languages: Object.fromEntries(Object.entries(languages).map(([l, p]) => [l, `${base}${p}`])) },
      };
    }),
  );
}
