import type { MetadataRoute } from "next";
import { getBrand } from "@/server/settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = await getBrand();
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: brand.primaryColor,
    icons: [{ src: brand.logoUrl, sizes: "any", type: brand.logoUrl.endsWith(".svg") ? "image/svg+xml" : "image/png", purpose: "any" }],
  };
}
