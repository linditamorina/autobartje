import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["sq", "en", "de"],
  defaultLocale: "sq",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];

export const localeNames: Record<AppLocale, string> = {
  sq: "Shqip",
  en: "English",
  de: "Deutsch",
};
