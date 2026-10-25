import { getTranslations } from "next-intl/server";
import { requirePortal } from "@/server/auth/guard";
import { PortalHeader } from "@/components/portal/header";
import { RequestForm } from "@/components/portal/request-form";

export const metadata = { title: "New request" };

export default async function NewRequestPage() {
  const { company, profile } = await requirePortal();
  const t = await getTranslations("Portal");
  return (
    <>
      <PortalHeader company={company.name} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <h1 className="text-2xl font-extrabold">{t("newTitle")}</h1>
        <p className="text-muted-foreground">{t("newLead")}</p>
        <RequestForm defaults={{ contactName: profile.name, contactPhone: profile.phone ?? "" }} />
      </main>
    </>
  );
}
