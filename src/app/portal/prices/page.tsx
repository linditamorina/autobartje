import { getLocale, getTranslations } from "next-intl/server";
import { requirePortal } from "@/server/auth/guard";
import { portalPrices } from "@/server/portal";
import { PortalHeader } from "@/components/portal/header";
import { fmtDate } from "@/components/admin/ui";
import { formatEur } from "@/lib/money";

export const metadata = { title: "Prices" };

export default async function PortalPrices() {
  const { company } = await requirePortal();
  const [t, tsv, tv, locale, prices] = await Promise.all([getTranslations("Portal"), getTranslations("Admin.service"), getTranslations("Quote.vehicleTypes"), getLocale(), portalPrices(company.id)]);
  return (
    <>
      <PortalHeader company={company.name} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <h1 className="text-2xl font-extrabold">{t("pricesTitle")}</h1>
        <p className="text-muted-foreground">{t("pricesLead")}</p>
        {prices.length === 0 ? (
          <p className="rounded-xl bg-card p-6 text-muted-foreground">{t("noPrices")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="p-3">{t("service")}</th>
                  <th scope="col" className="p-3">{t("vehicleType")}</th>
                  <th scope="col" className="p-3 text-right">{t("base")}</th>
                  <th scope="col" className="p-3 text-right">{t("perKm")}</th>
                  <th scope="col" className="p-3 text-right">{t("discount")}</th>
                  <th scope="col" className="p-3">{t("validTo")}</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3 font-semibold">{tsv(p.service)}</td>
                    <td className="p-3">{p.vehicleType ? tv(p.vehicleType) : t("allVehicles")}</td>
                    <td className="p-3 text-right tabular-nums">{p.baseCents != null ? formatEur(p.baseCents, locale) : "–"}</td>
                    <td className="p-3 text-right tabular-nums">{p.perKmCents != null ? formatEur(p.perKmCents, locale) : "–"}</td>
                    <td className="p-3 text-right tabular-nums">{p.discountBp ? `${(p.discountBp / 100).toLocaleString(locale)} %` : "–"}</td>
                    <td className="p-3">{p.validTo ? fmtDate(p.validTo, locale) : t("noEnd")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{t("pricesNote")}</p>
      </main>
    </>
  );
}
