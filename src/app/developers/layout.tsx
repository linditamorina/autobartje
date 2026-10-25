import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { themeInitScript } from "@/components/shared/theme-toggle";
import { BrandStyle } from "@/components/shared/brand-style";
import { getBrand } from "@/server/settings";
import "../globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return { title: `Partner API · ${brand.name}`, description: `Book and follow ${brand.name} towing and transport jobs from your own system.` };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Developer documentation for partners. English only: it is read by programmers. */
export default async function DevelopersLayout({ children }: { children: React.ReactNode }) {
  const brand = await getBrand();
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <BrandStyle color={brand.primaryColor} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">{children}</body>
    </html>
  );
}
