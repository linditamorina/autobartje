import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireStaff } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { COMPANY_TYPES } from "@/server/companies/manage";
import { uninvoicedOrders } from "@/server/invoicing/monthly";
import { PageHeader, Panel, StatusBadge, fmtDate } from "@/components/admin/ui";
import { FieldsForm, type FieldDef } from "@/components/admin/fields-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { MonthlyInvoiceForm } from "@/components/admin/monthly-invoice-form";
import { SERVICES, VEHICLE_TYPES } from "@/lib/validation/booking";
import { formatEur } from "@/lib/money";
import { businessDate } from "@/lib/time";
import { addContractAction, addPortalUserAction, deleteContractAction, saveCompanyAction, togglePortalUserAction } from "../actions";

export const metadata = { title: "Customer" };

/** The last three months, newest first, as YYYY-MM. */
function recentMonths(): string[] {
  const [y, m] = businessDate().slice(0, 7).split("-").map(Number);
  return [0, 1, 2].map((back) => {
    const d = new Date(Date.UTC(y, m - 1 - back, 1));
    return d.toISOString().slice(0, 7);
  });
}

export default async function CompanyPage({ params }: PageProps<"/admin/customers/[id]">) {
  const user = await requireStaff("customers.read");
  const { id } = await params;
  const company = id === "new" ? null : await db.company.findUnique({
    where: { id },
    include: {
      contractPrices: { orderBy: [{ service: "asc" }, { validFrom: "desc" }] },
      users: { orderBy: { name: "asc" }, select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true } },
      orders: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, number: true, status: true, customerRef: true, createdAt: true } },
    },
  });
  if (id !== "new" && !company) notFound();
  const [t, ts, tsv, tv, locale] = await Promise.all([getTranslations("Admin.customers"), getTranslations("Admin.status"), getTranslations("Admin.service"), getTranslations("Quote.vehicleTypes"), getLocale()]);
  const manage = can(user.permissions, "customers.manage");

  const fields: FieldDef[] = [
    { name: "name", label: t("name"), required: true, defaultValue: company?.name, wide: true },
    { name: "type", label: t("type"), type: "select", defaultValue: company?.type ?? "CAR_DEALER", options: COMPANY_TYPES.map((v) => ({ value: v, label: t(`types.${v}`) })) },
    { name: "nui", label: t("nui"), defaultValue: company?.nui, help: t("nuiHelp") },
    { name: "vatNumber", label: t("vatNumber"), defaultValue: company?.vatNumber },
    { name: "billingEmail", label: t("billingEmail"), type: "email", defaultValue: company?.billingEmail },
    { name: "address", label: t("address"), defaultValue: company?.address },
    { name: "city", label: t("city"), defaultValue: company?.city },
    { name: "paymentTermsDays", label: t("terms"), type: "number", defaultValue: company?.paymentTermsDays ?? 30 },
    { name: "monthlyInvoicing", label: t("monthly"), type: "checkbox", defaultValue: company?.monthlyInvoicing ?? false },
    { name: "isActive", label: t("active"), type: "checkbox", defaultValue: company?.isActive ?? true },
  ];

  const months = recentMonths();
  const pending = company && can(user.permissions, "invoices.issue")
    ? await Promise.all(months.map(async (m) => ({ month: m, count: (await uninvoicedOrders(company.id, m)).length })))
    : null;

  return (
    <>
      <Link href="/admin/customers" className="mb-2 inline-block text-sm font-semibold underline">← {t("title")}</Link>
      <PageHeader title={company ? company.name : t("newCompany")} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={t("companySection")}>
          {manage ? (
            <FieldsForm action={saveCompanyAction} fields={fields} hidden={company ? { id: company.id } : undefined} submitLabel={t("save")} errors={{ nui_taken: t("nuiTaken") }} />
          ) : (
            <p>{company?.name}</p>
          )}
        </Panel>

        {company && (
          <div className="space-y-4">
            <Panel title={t("contractSection")}>
              <p className="mb-3 text-sm text-muted-foreground">{t("contractLead")}</p>
              {company.contractPrices.length > 0 && (
                <ul className="mb-4 divide-y divide-border">
                  {company.contractPrices.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        <span className="font-semibold">{tsv(c.service)}</span> · {c.vehicleType ? tv(c.vehicleType) : t("allVehicles")}
                        <span className="block text-sm">
                          {[c.baseCents != null && `${t("base")} ${formatEur(c.baseCents, locale)}`, c.perKmCents != null && `${formatEur(c.perKmCents, locale)}/km`, c.discountBp && `−${c.discountBp / 100} %`].filter(Boolean).join(" · ")}
                        </span>
                        <span className="block text-xs text-muted-foreground">{fmtDate(c.validFrom, locale)} – {c.validTo ? fmtDate(c.validTo, locale) : t("noEnd")}</span>
                      </span>
                      {manage && <ConfirmButton action={deleteContractAction} hidden={{ id: c.id, companyId: company.id }} label={t("delete")} confirm={t("deleteConfirm")} />}
                    </li>
                  ))}
                </ul>
              )}
              {manage && (
                <FieldsForm
                  action={addContractAction}
                  hidden={{ companyId: company.id }}
                  resetOnSuccess
                  submitLabel={t("addContract")}
                  fields={[
                    { name: "service", label: t("service"), type: "select", defaultValue: "DOMESTIC_TRANSPORT", options: SERVICES.map((s) => ({ value: s, label: tsv(s) })) },
                    { name: "vehicleType", label: t("vehicleType"), type: "select", defaultValue: "", options: [{ value: "", label: t("allVehicles") }, ...VEHICLE_TYPES.map((v) => ({ value: v, label: tv(v) }))] },
                    { name: "baseEur", label: t("baseEur"), help: t("netHelp") },
                    { name: "perKmEur", label: t("perKmEur") },
                    { name: "discountPct", label: t("discountPct") },
                    { name: "validFrom", label: t("validFrom"), type: "date" },
                    { name: "validTo", label: t("validTo"), type: "date" },
                  ]}
                />
              )}
            </Panel>

            <Panel title={t("usersSection")}>
              {company.users.length > 0 && (
                <ul className="mb-4 divide-y divide-border">
                  {company.users.map((u) => (
                    <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        <span className="font-semibold">{u.name}</span> · {u.email}
                        <span className="block text-xs text-muted-foreground">{u.isActive ? (u.lastLoginAt ? t("lastLogin", { date: fmtDate(u.lastLoginAt, locale) }) : t("neverLoggedIn")) : t("inactive")}</span>
                      </span>
                      {manage && (
                        <ConfirmButton action={togglePortalUserAction} hidden={{ userId: u.id, companyId: company.id, active: u.isActive ? "0" : "1" }} label={u.isActive ? t("deactivate") : t("activate")} confirm={u.isActive ? t("deactivateConfirm") : t("activateConfirm")} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {manage && (
                <FieldsForm
                  action={addPortalUserAction}
                  hidden={{ companyId: company.id }}
                  resetOnSuccess
                  submitLabel={t("addUser")}
                  errors={{ email_taken: t("emailTaken") }}
                  fields={[
                    { name: "name", label: t("userName"), required: true },
                    { name: "email", label: t("userEmail"), type: "email", required: true },
                    { name: "phone", label: t("userPhone"), type: "tel" },
                    { name: "locale", label: t("userLocale"), type: "select", defaultValue: "sq", options: [{ value: "sq", label: "Shqip" }, { value: "en", label: "English" }, { value: "de", label: "Deutsch" }] },
                    { name: "password", label: t("userPassword"), type: "password", required: true, help: t("passwordHelp"), wide: true },
                  ]}
                />
              )}
            </Panel>

            {pending && (
              <Panel title={t("monthlySection")}>
                <p className="mb-3 text-sm text-muted-foreground">{t("monthlyLead")}</p>
                <MonthlyInvoiceForm companyId={company.id} months={pending} />
              </Panel>
            )}

            <Panel title={t("recentOrders")}>
              {company.orders.length === 0 ? (
                <p className="text-muted-foreground">{t("noOrders")}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {company.orders.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <Link href={`/admin/orders/${o.id}`} className="font-semibold underline">{o.number}</Link>
                      <span className="text-sm text-muted-foreground">{o.customerRef}</span>
                      <StatusBadge status={o.status} label={ts(o.status)} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}
