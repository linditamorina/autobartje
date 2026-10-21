import { BarChart3, ClipboardList, ExternalLink, FileText, Gauge, LogOut, Map, Navigation, Receipt, ScrollText, Send, Settings, Tags, Truck, UserCog, Users } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/server/auth/config";
import { can, type Permission } from "@/server/auth/permissions";
import type { Brand } from "@/server/settings";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { AdminLocaleSwitcher } from "./locale-switcher";
import { NavLink } from "./nav-link";
import { OrderAlerts } from "./order-alerts";

const NAV: { href: string; key: string; icon: typeof Gauge; permission?: Permission }[] = [
  { href: "/admin", key: "dashboard", icon: Gauge },
  { href: "/admin/orders", key: "orders", icon: ClipboardList, permission: "orders.read" },
  { href: "/admin/dispatch", key: "dispatch", icon: Map, permission: "dispatch.read" },
  { href: "/admin/map", key: "liveMap", icon: Navigation, permission: "dispatch.read" },
  { href: "/admin/fleet", key: "fleet", icon: Truck, permission: "fleet.read" },
  { href: "/admin/pricing", key: "pricing", icon: Tags, permission: "pricing.read" },
  { href: "/admin/invoices", key: "invoices", icon: Receipt, permission: "invoices.read" },
  { href: "/admin/customers", key: "customers", icon: Users, permission: "customers.read" },
  { href: "/admin/reports", key: "reports", icon: BarChart3, permission: "reports.read" },
  { href: "/admin/content", key: "content", icon: FileText, permission: "cms.manage" },
  { href: "/admin/users", key: "users", icon: UserCog, permission: "users.manage" },
  { href: "/admin/messages", key: "messages", icon: Send, permission: "settings.manage" },
  { href: "/admin/settings", key: "settings", icon: Settings, permission: "settings.manage" },
  { href: "/admin/audit", key: "audit", icon: ScrollText, permission: "audit.read" },
];

/** Pages that exist in this release; the rest appear as their PRs land. */
const LIVE = new Set(["dashboard", "orders", "dispatch", "liveMap", "fleet", "pricing", "invoices", "customers", "content", "users", "messages", "settings", "audit"]);

export async function AdminShell({ user, brand, children }: { user: { name?: string | null; role: string; permissions: string[] }; brand: Brand; children: React.ReactNode }) {
  const t = await getTranslations("Admin.nav");
  const items = NAV.filter((n) => LIVE.has(n.key) && (!n.permission || can(user.permissions, n.permission)));

  const nav = (
    <ul className="space-y-1">
      {items.map((n) => (
        <li key={n.href}>
          <NavLink href={n.href} exact={n.href === "/admin"}>
            <n.icon aria-hidden className="size-5" /> {t(n.key as never)}
          </NavLink>
        </li>
      ))}
    </ul>
  );

  const logout = (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/admin/login" });
      }}
    >
      <button type="submit" className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 font-semibold hover:bg-muted">
        <LogOut aria-hidden className="size-5" /> {t("logout")}
      </button>
    </form>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background px-3 py-2 lg:hidden">
        <details className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center rounded-lg px-3 font-semibold hover:bg-muted">{t("menu")}</summary>
          <nav aria-label={t("menu")} className="absolute left-0 right-0 top-full border-b border-border bg-background p-3 shadow-lg">
            {nav}
            <div className="mt-2 border-t border-border pt-2">{logout}</div>
          </nav>
        </details>
        <Link href="/admin" className="font-extrabold">{brand.name}</Link>
        <div className="flex items-center">
          <OrderAlerts />
          <ThemeToggle />
        </div>
      </header>

      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-background p-3 lg:flex">
        <Link href="/admin" className="mb-6 px-2">
          <Logo brand={brand} />
        </Link>
        <nav aria-label={t("menu")} className="flex-1 overflow-y-auto">{nav}</nav>
        <div className="space-y-1 border-t border-border pt-3">
          <p className="px-3 text-sm">
            <span className="font-semibold">{user.name}</span>
            <span className="block text-muted-foreground">{user.role}</span>
          </p>
          <a href="/" target="_blank" className="flex min-h-12 items-center gap-3 rounded-lg px-3 font-semibold hover:bg-muted">
            <ExternalLink aria-hidden className="size-5" /> {t("viewSite")}
          </a>
          <div className="flex items-center gap-1 px-1">
            <AdminLocaleSwitcher />
            <ThemeToggle />
            <OrderAlerts />
          </div>
          {logout}
        </div>
      </aside>

      <main id="main" className="min-w-0 p-4 lg:p-8">
        {children}
      </main>
    </div>
  );
}
