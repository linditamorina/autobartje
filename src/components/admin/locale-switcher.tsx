"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { routing } from "@/i18n/routing";

export function AdminLocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("Admin.common");
  return (
    <label>
      <span className="sr-only">{t("language")}</span>
      <select
        value={locale}
        className="min-h-12 rounded-lg border-2 border-border bg-background px-2 text-sm font-semibold"
        onChange={(e) => {
          document.cookie = `ab_admin_locale=${e.target.value}; Path=/; Max-Age=31536000; SameSite=Lax`;
          router.refresh();
        }}
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {l.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
