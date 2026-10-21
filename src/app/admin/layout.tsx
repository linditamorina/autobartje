import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { themeInitScript } from "@/components/shared/theme-toggle";
import { BrandStyle } from "@/components/shared/brand-style";
import { getBrand } from "@/server/settings";
import "../globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const [locale, brand] = await Promise.all([getLocale(), getBrand()]);
  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <BrandStyle color={brand.primaryColor} />
      </head>
      <body className="min-h-dvh bg-muted font-sans antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
