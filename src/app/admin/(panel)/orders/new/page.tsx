import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/guard";
import { PageHeader } from "@/components/admin/ui";
import { ManualOrderForm } from "@/components/admin/manual-order-form";

export const metadata = { title: "New order" };

export default async function NewOrderPage() {
  await requireStaff("orders.create");
  const t = await getTranslations("Admin.orders");
  return (
    <>
      <Link href="/admin/orders" className="mb-2 inline-block text-sm font-semibold underline">← {t("back")}</Link>
      <PageHeader title={t("manualTitle")} />
      <ManualOrderForm />
    </>
  );
}
