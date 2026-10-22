import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/guard";
import { getBrand, getSettings } from "@/server/settings";
import { publicStorageConfigured } from "@/server/files/storage";
import { PageHeader, Panel } from "@/components/admin/ui";
import { LogoForm, SettingsForm } from "@/components/admin/settings-forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireStaff("settings.manage");
  const [t, settings, brand] = await Promise.all([getTranslations("Admin.settings"), getSettings(), getBrand()]);
  return (
    <>
      <PageHeader title={t("title")} />
      <Panel title={t("logo")} className="mb-4">
        <LogoForm logoUrl={brand.logoUrl} custom={Boolean(settings["brand.logoKey"])} storageReady={publicStorageConfigured()} />
      </Panel>
      <SettingsForm values={settings} />
    </>
  );
}
