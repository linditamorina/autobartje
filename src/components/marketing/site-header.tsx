import { Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { formatPhone, telHref } from "@/lib/contact";
import type { Brand } from "@/server/settings";

export async function SiteHeader({ brand, phone }: { brand: Brand; phone: string }) {
  const t = await getTranslations("Nav");
  const nav = [
    { href: "/services", label: t("services") },
    { href: "/import-guide", label: t("import") },
    { href: "/pricing", label: t("pricing") },
    { href: "/fleet", label: t("fleet") },
    { href: "/contact", label: t("contact") },
  ] as const;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:p-3 focus:text-primary-foreground">
        {t("skipToContent")}
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
        <Link href="/" className="rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring">
          <Logo brand={brand} />
        </Link>
        <nav aria-label={t("menu")} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="inline-flex min-h-12 items-center rounded-lg px-3 font-semibold hover:bg-muted">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1">
          <Button asChild variant="emergency" className="hidden md:inline-flex">
            <a href={telHref(phone)} data-track="call_click">
              <Phone aria-hidden />
              {formatPhone(phone)}
            </a>
          </Button>
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
