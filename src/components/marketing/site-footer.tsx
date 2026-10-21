import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatPhone, telHref } from "@/lib/contact";
import type { Settings } from "@/server/settings";
import { CookieSettingsLink } from "@/components/shared/consent-banner";

export async function SiteFooter({ settings }: { settings: Settings }) {
  const t = await getTranslations("Footer");
  const nav = await getTranslations("Nav");
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-border bg-muted">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold">{settings["brand.name"]}</p>
          <p className="mt-2 text-muted-foreground">{settings["brand.tagline"]}</p>
          <p className="mt-4">
            <a href={telHref(settings["contact.phone"])} className="font-bold underline underline-offset-4">
              {formatPhone(settings["contact.phone"])}
            </a>
          </p>
          <p>
            <a href={`mailto:${settings["contact.email"]}`} className="underline underline-offset-4">
              {settings["contact.email"]}
            </a>
          </p>
        </div>
        <nav aria-label={nav("menu")}>
          <ul className="space-y-2">
            <li><Link href="/services" className="underline-offset-4 hover:underline">{nav("services")}</Link></li>
            <li><Link href="/import-guide" className="underline-offset-4 hover:underline">{nav("import")}</Link></li>
            <li><Link href="/pricing" className="underline-offset-4 hover:underline">{nav("pricing")}</Link></li>
            <li><Link href="/about" className="underline-offset-4 hover:underline">{nav("about")}</Link></li>
            <li><Link href="/contact" className="underline-offset-4 hover:underline">{nav("contact")}</Link></li>
          </ul>
        </nav>
        <nav aria-label={t("legal")}>
          <ul className="space-y-2">
            <li><Link href="/legal/terms" className="underline-offset-4 hover:underline">{t("terms")}</Link></li>
            <li><Link href="/legal/privacy" className="underline-offset-4 hover:underline">{t("privacy")}</Link></li>
            <li><Link href="/legal/cookies" className="underline-offset-4 hover:underline">{t("cookies")}</Link></li>
            <li><CookieSettingsLink label={t("cookieSettings")} /></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-muted-foreground">
          © {year} {settings["company.legalName"]}
          {settings["company.nui"] && ` · ${t("nui")} ${settings["company.nui"]}`} · {t("rights")}
        </p>
      </div>
    </footer>
  );
}
