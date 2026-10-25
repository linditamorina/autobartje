import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell } from "@/components/marketing/page-shell";
import { formatPhone, mapsLink, telHref, whatsappHref } from "@/lib/contact";
import { alternates } from "@/lib/seo";
import { getSettings } from "@/server/settings";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pages" });
  return { title: t("contactTitle"), description: t("contactIntro"), alternates: alternates("/contact", locale) };
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, ta, s] = await Promise.all([getTranslations("Pages"), getTranslations("ActionBar"), getSettings()]);
  const address = [s["company.address"], s["company.city"]].filter(Boolean).join(", ");
  const rows = [
    { icon: Phone, label: t("phone"), value: formatPhone(s["contact.phone"]), href: telHref(s["contact.phone"]), track: "call_click" },
    { icon: MessageCircle, label: "WhatsApp", value: formatPhone(s["contact.whatsapp"]), href: whatsappHref(s["contact.whatsapp"], ta("whatsappText")), track: "whatsapp_click", external: true },
    { icon: Mail, label: t("email"), value: s["contact.email"], href: `mailto:${s["contact.email"]}` },
    { icon: MapPin, label: t("address"), value: address, href: mapsLink(s["contact.lat"], s["contact.lng"]), external: true, extra: t("directions") },
    { icon: Clock, label: t("hours"), value: t("hoursValue") },
  ];
  return (
    <PageShell crumbs={[{ href: "/contact", label: t("contactTitle") }]} title={t("contactTitle")} lead={t("contactIntro")}>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex gap-3 rounded-xl border border-border bg-card p-4">
            <r.icon aria-hidden className="mt-1 size-6 shrink-0 text-primary dark:text-foreground" />
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">{r.label}</dt>
              <dd className="break-words text-lg font-bold">
                {r.href ? (
                  <a href={r.href} data-track={r.track} className="underline-offset-4 hover:underline" {...(r.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    {r.value}
                    {r.extra && <span className="block text-sm font-semibold text-muted-foreground">{r.extra}</span>}
                  </a>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          </div>
        ))}
      </dl>
      {s["company.legalName"] && (
        <p className="mt-6 text-muted-foreground">
          {s["company.legalName"]}
          {s["company.nui"] && ` · NUI ${s["company.nui"]}`}
        </p>
      )}
    </PageShell>
  );
}
