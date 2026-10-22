import { getBrand } from "@/server/settings";

export async function GET() {
  const brand = await getBrand();
  const icon = brand.logoUrl;
  return Response.json(
    {
      name: `${brand.name} Driver`,
      short_name: brand.name,
      start_url: "/driver",
      scope: "/driver",
      display: "standalone",
      orientation: "portrait",
      background_color: "#ffffff",
      theme_color: brand.primaryColor,
      icons: [{ src: icon, sizes: "any", type: icon.endsWith(".svg") ? "image/svg+xml" : "image/png", purpose: "any" }],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
