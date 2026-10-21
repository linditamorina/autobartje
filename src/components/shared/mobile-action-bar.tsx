import { MessageCircle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { telHref, whatsappHref } from "@/lib/contact";
import { LocationButton } from "./location-button";

const item = "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 text-xs font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring [&_svg]:size-6";

/** Sticky bottom bar on phones: call, WhatsApp, send location. */
export function MobileActionBar({ phone, whatsapp }: { phone: string; whatsapp: string }) {
  const t = useTranslations("ActionBar");
  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.12)] md:hidden"
    >
      <a href={telHref(phone)} className={`${item} bg-emergency text-emergency-foreground`} data-track="call_click">
        <Phone aria-hidden />
        {t("call")}
      </a>
      <a href={whatsappHref(whatsapp, t("whatsappText"))} className={`${item} bg-whatsapp text-whatsapp-foreground`} data-track="whatsapp_click" target="_blank" rel="noopener">
        <MessageCircle aria-hidden />
        {t("whatsapp")}
      </a>
      <LocationButton whatsapp={whatsapp} className={`${item} bg-primary text-primary-foreground`} />
    </nav>
  );
}
