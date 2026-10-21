import { ArrowRight, CalendarClock, Phone, ShieldCheck, Siren, Truck, Wrench, Globe2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationButton } from "@/components/shared/location-button";
import { JsonLd, localBusinessJsonLd } from "@/components/shared/json-ld";
import { formatPhone, telHref } from "@/lib/contact";
import { getBrand, getSettings } from "@/server/settings";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, ts, tt, settings, brand] = await Promise.all([
    getTranslations("Hero"),
    getTranslations("Services"),
    getTranslations("Trust"),
    getSettings(),
    getBrand(),
  ]);
  const phone = settings["contact.phone"];

  const services = [
    { slug: "emergency-towing", icon: Siren, title: ts("emergencyTowing"), text: ts("emergencyTowingText") },
    { slug: "roadside-assistance", icon: Wrench, title: ts("roadside"), text: ts("roadsideText") },
    { slug: "car-transport", icon: Truck, title: ts("domestic"), text: ts("domesticText") },
    { slug: "car-import", icon: Globe2, title: ts("international"), text: ts("internationalText") },
  ];

  return (
    <>
      <JsonLd data={localBusinessJsonLd(settings, brand, locale)} />

      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-8 md:py-14">
          <Badge variant="emergency" className="text-sm">{t("badge")}</Badge>
          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">{t("title")}</h1>
          <p className="mt-3 max-w-2xl text-lg opacity-90">{t("subtitle", { minutes: settings["stats.avgArrivalMinutes"] })}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border-4 border-emergency bg-background p-5 text-foreground">
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-emergency">
                <Siren aria-hidden className="size-6" /> {t("emergencyTitle")}
              </h2>
              <p className="mt-1">{t("emergencyText")}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button asChild variant="emergency" size="lg">
                  <a href={telHref(phone)} data-track="call_click">
                    <Phone aria-hidden /> {t("emergencyCall")}
                  </a>
                </Button>
                <LocationButton
                  whatsapp={settings["contact.whatsapp"]}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg border-2 border-emergency px-4 text-lg font-semibold text-emergency hover:bg-muted [&_svg]:size-5"
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{formatPhone(phone)}</p>
            </div>

            <div className="rounded-xl bg-background p-5 text-foreground">
              <h2 className="flex items-center gap-2 text-xl font-extrabold">
                <CalendarClock aria-hidden className="size-6" /> {t("plannedTitle")}
              </h2>
              <p className="mt-1">{t("plannedText")}</p>
              <Button asChild size="lg" className="mt-4 w-full sm:w-auto">
                <Link href="/quote">
                  {t("plannedCta")} <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="services-title" className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="services-title" className="text-2xl font-extrabold md:text-3xl">{ts("title")}</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <li key={s.slug}>
              <Card className="h-full">
                <CardHeader>
                  <s.icon aria-hidden className="size-8 text-primary" />
                  <CardTitle>{s.title}</CardTitle>
                  <CardDescription className="text-base">{s.text}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/services/${s.slug}`} className="inline-flex min-h-12 items-center gap-1 font-bold underline underline-offset-4">
                    {ts("more")} <span className="sr-only">: {s.title}</span> <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="trust-title" className="bg-muted">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 id="trust-title" className="text-2xl font-extrabold md:text-3xl">{tt("title")}</h2>
          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              [settings["stats.yearsInBusiness"], tt("years")],
              [`${settings["stats.vehiclesMoved"].toLocaleString(locale)}+`, tt("vehicles")],
              [settings["stats.avgArrivalMinutes"], tt("arrival")],
            ].map(([value, label]) => (
              <div key={String(label)} className="rounded-xl bg-background p-5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-4xl font-extrabold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 flex items-start gap-3 text-lg">
            <ShieldCheck aria-hidden className="mt-0.5 size-7 shrink-0 text-success" />
            <span>
              <strong>{tt("insured")}.</strong> {tt("insuredText")}
            </span>
          </p>
        </div>
      </section>
    </>
  );
}
