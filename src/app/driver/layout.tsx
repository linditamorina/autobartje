import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { themeInitScript } from "@/components/shared/theme-toggle";
import { BrandStyle } from "@/components/shared/brand-style";
import { RegisterWorker } from "@/components/driver/register-worker";
import { getBrand } from "@/server/settings";
import "../globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    title: { default: `${brand.name} · Driver`, template: `%s · ${brand.name}` },
    robots: { index: false, follow: false },
    manifest: "/driver/manifest.webmanifest",
    appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b2545" };

export default async function DriverRootLayout({ children }: { children: React.ReactNode }) {
  const [locale, brand] = await Promise.all([getLocale(), getBrand()]);
  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <BrandStyle color={brand.primaryColor} />
      </head>
      <body className="min-h-dvh bg-muted font-sans text-lg antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <RegisterWorker />
      </body>
    </html>
  );
}
