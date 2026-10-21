"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeNames, routing, type AppLocale } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("Common");
  return (
    <label className="inline-flex items-center">
      <span className="sr-only">{t("language")}</span>
      <select
        value={locale}
        onChange={(e) => router.replace(pathname, { locale: e.target.value as AppLocale })}
        className="min-h-12 rounded-lg border-2 border-border bg-background px-2 text-sm font-semibold"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l} lang={l} aria-label={localeNames[l]}>
            {l.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
