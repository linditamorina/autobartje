import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getBrand, getSettings } from "@/server/settings";
import { BrandStyle } from "@/components/shared/brand-style";
import { ConsentBanner } from "@/components/shared/consent-banner";
import { Analytics } from "@/components/shared/analytics";
import { MobileActionBar } from "@/components/shared/mobile-action-bar";
import { themeInitScript } from "@/components/shared/theme-toggle";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { alternates, siteUrl } from "@/lib/seo";
import "../globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  const brand = await getBrand();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t("title", { brand: brand.name }), template: `%s | ${brand.name}` },
    description: t("description"),
    alternates: alternates("/", locale),
    openGraph: { type: "website", siteName: brand.name, locale },
    icons: { icon: brand.logoUrl },
    manifest: "/manifest.webmanifest",
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [settings, brand] = await Promise.all([getSettings(), getBrand()]);

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <BrandStyle color={brand.primaryColor} />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        <NextIntlClientProvider>
          <SiteHeader brand={brand} phone={settings["contact.phone"]} />
          <main id="main">{children}</main>
          <SiteFooter settings={settings} />
          <MobileActionBar phone={settings["contact.phone"]} whatsapp={settings["contact.whatsapp"]} />
          <ConsentBanner />
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
