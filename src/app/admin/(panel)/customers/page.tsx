import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const user = await requireStaff("customers.read");
  const t = await getTranslations("Admin.customers");
  const companies = await db.company.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true, orders: { where: { status: { in: ["RECEIVED", "CONFIRMED", "DRIVER_EN_ROUTE", "PICKED_UP", "IN_TRANSIT"] } } } } } },
  });
  return (
    <>
      <PageHeader title={t("title")}>
        {can(user.permissions, "customers.manage") && <Button asChild><Link href="/admin/customers/new">{t("newCompany")}</Link></Button>}
      </PageHeader>
      <p className="mb-4 max-w-3xl text-muted-foreground">{t("lead")}</p>
      <Panel>
        {companies.length === 0 ? (
          <p className="text-muted-foreground">{t("none")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="p-2">{t("name")}</th>
                  <th scope="col" className="p-2">{t("type")}</th>
                  <th scope="col" className="p-2">{t("nui")}</th>
                  <th scope="col" className="p-2 text-right">{t("portalUsers")}</th>
                  <th scope="col" className="p-2 text-right">{t("openOrders")}</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="p-2">
                      <Link href={`/admin/customers/${c.id}`} className="font-semibold underline">{c.name}</Link>
                      {!c.isActive && <span className="ml-2 text-xs text-muted-foreground">({t("inactive")})</span>}
                    </td>
                    <td className="p-2">{t(`types.${c.type}`)}</td>
                    <td className="p-2">{c.nui ?? "–"}</td>
                    <td className="p-2 text-right tabular-nums">{c._count.users}</td>
                    <td className="p-2 text-right tabular-nums">{c._count.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
