import type { Brand, Settings } from "@/server/settings";
import { siteUrl } from "@/lib/seo";

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // Escape "<" so content can never close the script tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function localBusinessJsonLd(s: Settings, brand: Brand, locale: string): Record<string, unknown> {
  const url = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": ["AutomotiveBusiness", "LocalBusiness"],
    "@id": `${url}/#business`,
    name: brand.name,
    description: brand.tagline,
    url,
    logo: brand.logoUrl.startsWith("http") ? brand.logoUrl : `${url}${brand.logoUrl}`,
    telephone: s["contact.phone"],
    email: s["contact.email"],
    inLanguage: locale,
    priceRange: "€€",
    currenciesAccepted: "EUR",
    address: {
      "@type": "PostalAddress",
      streetAddress: s["company.address"] || undefined,
      addressLocality: s["company.city"],
      addressCountry: "XK",
    },
    geo: { "@type": "GeoCoordinates", latitude: s["contact.lat"], longitude: s["contact.lng"] },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "00:00",
      closes: "23:59",
    },
    areaServed: [{ "@type": "Country", name: "Kosovo" }],
  };
}
