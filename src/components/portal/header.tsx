import Link from "next/link";
import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getBrand } from "@/server/settings";
import { portalLogoutAction } from "@/app/portal/actions";
import { AdminLocaleSwitcher } from "@/components/admin/locale-switcher";
import { NavLink } from "@/components/admin/nav-link";

export async function PortalHeader({ company }: { company: string }) {
  const [t, brand] = await Promise.all([getTranslations("Portal"), getBrand()]);
  const nav = [
    { href: "/portal", label: t("nav.orders") },
    { href: "/portal/new", label: t("nav.new") },
    { href: "/portal/invoices", label: t("nav.invoices") },
    { href: "/portal/prices", label: t("nav.prices") },
  ];
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/portal" className="font-extrabold">{brand.name}</Link>
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{company}</span>
        <AdminLocaleSwitcher />
        <form action={portalLogoutAction}>
          <button type="submit" className="flex min-h-12 items-center gap-1 rounded-lg px-3 font-semibold hover:bg-muted">
            <LogOut aria-hidden className="size-5" /> <span className="sr-only sm:not-sr-only">{t("logout")}</span>
          </button>
        </form>
      </div>
      <nav aria-label={t("nav.label")} className="mx-auto max-w-6xl overflow-x-auto px-2">
        <ul className="flex gap-1">
          {nav.map((n) => (
            <li key={n.href}><NavLink href={n.href} exact={n.href === "/portal"}>{n.label}</NavLink></li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
