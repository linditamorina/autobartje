import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export const ADMIN_LOCALE_COOKIE = "ab_admin_locale";

export default getRequestConfig(async ({ requestLocale }) => {
  // Public pages carry the locale in the URL; admin and driver pages use a cookie.
  let requested = await requestLocale;
  if (!requested) requested = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    timeZone: "Europe/Belgrade",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
