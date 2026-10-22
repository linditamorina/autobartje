import type { Metadata } from "next";
import { CheckCircle2, Phone } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { TOKEN_RE } from "@/lib/tracking";
import { formatPhone, telHref } from "@/lib/contact";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { robots: { index: false }, referrer: "no-referrer" };

export default async function BookingDonePage({ params, searchParams }: PageProps<"/[locale]/book/done">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, settings, sp] = await Promise.all([getTranslations("Booking"), getSettings(), searchParams]);
  const raw = typeof sp.order === "string" ? sp.order : "";
  const number = /^P-\d{4}-\d{5,}$/.test(raw) ? raw : "";
  const token = typeof sp.t === "string" && TOKEN_RE.test(sp.t) ? sp.t : "";

  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center">
      <CheckCircle2 aria-hidden className="mx-auto size-16 text-success" />
      <h1 className="mt-4 text-3xl font-extrabold">{t("doneTitle")}</h1>
      {number && (
        <>
          <p className="mt-4 text-lg">{t("doneText", { number })}</p>
          <p className="mt-4 rounded-xl bg-muted p-4 text-3xl font-extrabold tracking-wider" data-testid="order-number">
            {number}
          </p>
          <p className="mt-4 text-muted-foreground">{t("doneSave")}</p>
        </>
      )}
      {token && (
        <Button asChild size="lg" className="mt-6">
          <Link href={`/track/${token}`}>{t("doneTrack")}</Link>
        </Button>
      )}
      <Button asChild variant="emergency" size="lg" className="mt-8">
        <a href={telHref(settings["contact.phone"])} data-track="call_click">
          <Phone aria-hidden /> {t("doneCall")}: {formatPhone(settings["contact.phone"])}
        </a>
      </Button>
    </div>
  );
}
