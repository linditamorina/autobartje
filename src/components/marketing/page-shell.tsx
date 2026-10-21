import { ArrowRight, MessageCircle, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/shared/json-ld";
import { formatPhone, telHref, whatsappHref } from "@/lib/contact";
import { localePath, siteUrl } from "@/lib/seo";
import { BUSINESS_TZ } from "@/lib/time";
import { getSettings } from "@/server/settings";

export type Crumb = { href: string; label: string };

/** Common frame for public content pages: breadcrumbs, heading, lead text and a help box. */
export async function PageShell({
  crumbs,
  title,
  lead,
  updatedAt,
  children,
  help = true,
  quoteHref = "/quote",
}: {
  crumbs: Crumb[];
  title: string;
  lead?: string;
  updatedAt?: string | null;
  children: React.ReactNode;
  help?: boolean;
  quoteHref?: string;
}) {
  const [t, locale] = await Promise.all([getTranslations("Pages"), getLocale()]);
  const trail: Crumb[] = [{ href: "/", label: t("home") }, ...crumbs];
  const base = siteUrl();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: trail.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: `${base}${localePath(c.href, locale)}` })),
        }}
      />
      <nav aria-label={t("breadcrumb")} className="mb-4 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          {trail.map((c, i) => (
            <li key={c.href} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden>/</span>}
              {i === trail.length - 1 ? (
                <span aria-current="page">{c.label}</span>
              ) : (
                <Link href={c.href} className="underline-offset-4 hover:underline">{c.label}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
      {lead && <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{lead}</p>}
      <div className={help ? "mt-8 grid gap-8 lg:grid-cols-[1fr_320px]" : "mt-8"}>
        <div className="min-w-0">
          {children}
          {updatedAt && (
            <p className="mt-10 text-sm text-muted-foreground">
              {t("updated", { date: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: BUSINESS_TZ }).format(new Date(updatedAt)) })}
            </p>
          )}
        </div>
        {help && (
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <HelpBox quoteHref={quoteHref} />
          </aside>
        )}
      </div>
    </div>
  );
}

export async function HelpBox({ quoteHref = "/quote" }: { quoteHref?: string }) {
  const [t, ta, settings] = await Promise.all([getTranslations("Pages"), getTranslations("ActionBar"), getSettings()]);
  const phone = settings["contact.phone"];
  return (
    <div className="rounded-xl border-2 border-border bg-card p-5">
      <h2 className="text-xl font-extrabold">{t("helpTitle")}</h2>
      <p className="mt-1 text-muted-foreground">{t("helpText")}</p>
      <div className="mt-4 grid gap-2">
        <Button asChild variant="emergency" size="lg">
          <a href={telHref(phone)} data-track="call_click">
            <Phone aria-hidden /> {formatPhone(phone)}
          </a>
        </Button>
        <Button asChild variant="whatsapp" size="lg">
          <a href={whatsappHref(settings["contact.whatsapp"], ta("whatsappText"))} data-track="whatsapp_click" target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden /> {ta("whatsapp")}
          </a>
        </Button>
        <Button asChild size="lg">
          <Link href={quoteHref}>
            {t("getPrice")} <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}
