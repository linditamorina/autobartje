"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetLogoAction, saveSettingsAction, uploadLogoAction, type SettingsState } from "@/app/admin/(panel)/settings/actions";
import type { Settings } from "@/server/settings/defaults";
import { Panel } from "./ui";

function Feedback({ state }: { state: SettingsState }) {
  const t = useTranslations("Admin.settings");
  if (!state) return null;
  if (state.ok) return <p role="status" className="text-sm font-semibold text-success">{t("saved")}</p>;
  const msg = state.error === "logoType" ? t("logoTypeError") : state.error === "logoSize" ? t("logoSizeError") : state.error === "storage" ? t("storageMissing") : t("invalid");
  return <p role="alert" className="text-sm font-semibold text-destructive">{msg}</p>;
}

export function LogoForm({ logoUrl, custom, storageReady }: { logoUrl: string; custom: boolean; storageReady: boolean }) {
  const t = useTranslations("Admin.settings");
  const [upState, upload, uploading] = useActionState<SettingsState, FormData>(uploadLogoAction, undefined);
  const [resetState, reset, resetting] = useActionState<SettingsState, FormData>(resetLogoAction, undefined);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- preview of an arbitrary uploaded logo */}
        <img src={logoUrl} alt={t("logo")} width={80} height={80} className="size-20 rounded-xl border border-border bg-white object-contain p-1" />
        <p className="text-sm text-muted-foreground">{t("logoHelp")}</p>
      </div>
      {storageReady ? (
        <form action={upload} className="flex flex-wrap items-end gap-2">
          <label className="flex-1 space-y-1">
            <span className="text-sm font-semibold">{t("uploadLogo")}</span>
            <Input type="file" name="logo" accept="image/png,image/webp,image/svg+xml" required className="py-2.5" />
          </label>
          <Button type="submit" variant="secondary" disabled={uploading}>{t("uploadLogo")}</Button>
        </form>
      ) : (
        <p className="text-sm font-semibold text-muted-foreground">{t("storageMissing")}</p>
      )}
      {custom && (
        <form action={reset}>
          <Button type="submit" variant="outline" size="sm" disabled={resetting}>{t("resetLogo")}</Button>
        </form>
      )}
      <Feedback state={upState ?? resetState} />
    </div>
  );
}

type Field = { key: keyof Settings; label: string; type?: "text" | "number" | "color" | "email" | "tel"; help?: string };

export function SettingsForm({ values }: { values: Settings }) {
  const t = useTranslations("Admin.settings");
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, undefined);
  const invalid = new Set(state?.fields ?? []);

  const groups: { title: string; fields: Field[] }[] = [
    { title: t("brand"), fields: [
      { key: "brand.name", label: t("brandName") },
      { key: "brand.tagline", label: t("tagline") },
      { key: "brand.primaryColor", label: t("primaryColor"), type: "color" },
    ] },
    { title: t("company"), fields: [
      { key: "company.legalName", label: t("legalName") },
      { key: "company.nui", label: t("nui"), help: t("nuiHelp") },
      { key: "company.address", label: t("address") },
      { key: "company.city", label: t("city") },
      { key: "company.iban", label: t("iban") },
      { key: "company.bank", label: t("bank") },
    ] },
    { title: t("contact"), fields: [
      { key: "contact.phone", label: t("phone"), type: "tel" },
      { key: "contact.whatsapp", label: t("whatsapp"), type: "tel" },
      { key: "contact.email", label: t("email"), type: "email" },
    ] },
    { title: t("stats"), fields: [
      { key: "stats.yearsInBusiness", label: t("years"), type: "number" },
      { key: "stats.vehiclesMoved", label: t("vehicles"), type: "number" },
      { key: "stats.avgArrivalMinutes", label: t("arrival"), type: "number" },
    ] },
    { title: t("invoicing"), fields: [
      { key: "invoice.series", label: t("series") },
      { key: "invoice.paymentTermsDays", label: t("terms"), type: "number" },
    ] },
    { title: t("retention"), fields: [
      { key: "retention.inspectionPhotosDays", label: t("retentionPhotos"), type: "number" },
      { key: "retention.documentsDays", label: t("retentionDocs"), type: "number" },
      { key: "retention.draftsDays", label: t("retentionDrafts"), type: "number" },
    ] },
  ];

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <Panel key={g.title} title={g.title}>
            <div className="space-y-3">
              {g.fields.map((f) => (
                <label key={f.key} className="block space-y-1">
                  <span className="text-sm font-semibold">{f.label}</span>
                  <Input
                    name={f.key}
                    type={f.type ?? "text"}
                    defaultValue={String(values[f.key] ?? "")}
                    aria-invalid={invalid.has(f.key) || undefined}
                    min={f.type === "number" ? 0 : undefined}
                    className={f.type === "color" ? "h-12 w-24 p-1" : undefined}
                  />
                  {f.help && <span className="block text-xs text-muted-foreground">{f.help}</span>}
                </label>
              ))}
            </div>
          </Panel>
        ))}
      </div>
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-border bg-background py-3">
        <Button type="submit" disabled={pending}>{t("save")}</Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
