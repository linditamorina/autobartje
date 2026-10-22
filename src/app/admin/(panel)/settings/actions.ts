"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { assertStaff } from "@/server/auth/guard";
import { clientIp } from "@/server/security/request";
import { getSettings, SETTINGS_TAG, settingsSchema, type SettingKey, type Settings } from "@/server/settings";
import { deletePublicObject, LOGO_TYPES, MAX_LOGO_BYTES, publicStorageConfigured, putPublicObject } from "@/server/files/storage";

export type SettingsState = { ok?: boolean; error?: "invalid" | "logoType" | "logoSize" | "storage"; fields?: string[] } | undefined;

/** Keys editable from the form, with how to read each from FormData. Location and VAT stay code/seed managed. */
const TEXT_KEYS = [
  "brand.name", "brand.tagline", "brand.primaryColor",
  "company.legalName", "company.nui", "company.address", "company.city", "company.iban", "company.bank",
  "contact.phone", "contact.whatsapp", "contact.email", "review.url",
  "invoice.series",
] as const satisfies readonly SettingKey[];
const INT_KEYS = [
  "invoice.paymentTermsDays",
  "retention.inspectionPhotosDays", "retention.documentsDays", "retention.draftsDays", "retention.gpsDays",
  "stats.yearsInBusiness", "stats.vehiclesMoved", "stats.avgArrivalMinutes",
] as const satisfies readonly SettingKey[];

const formSchema = settingsSchema.pick({
  ...Object.fromEntries([...TEXT_KEYS, ...INT_KEYS].map((k) => [k, true])),
} as Record<(typeof TEXT_KEYS)[number] | (typeof INT_KEYS)[number], true>).extend({
  "company.nui": z.string().trim().regex(/^(\d{9})?$/),
  "contact.email": z.email(),
});

async function saveSettings(patch: Partial<Settings>, actorId: string) {
  const before = await getSettings();
  const changed = (Object.keys(patch) as SettingKey[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(patch[k]));
  if (!changed.length) return;
  const ip = await clientIp();
  await db.$transaction(async (tx) => {
    for (const key of changed) {
      const value = patch[key] as never;
      await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    }
    await audit(tx, {
      actorId,
      action: "settings.updated",
      entityType: "Setting",
      entityId: changed.join(","),
      before: Object.fromEntries(changed.map((k) => [k, before[k]])),
      after: Object.fromEntries(changed.map((k) => [k, patch[k]])),
      ip,
    });
  });
  updateTag(SETTINGS_TAG);
}

export async function saveSettingsAction(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await assertStaff("settings.manage");
  const raw: Record<string, unknown> = {};
  for (const k of TEXT_KEYS) raw[k] = String(form.get(k) ?? "").trim();
  for (const k of INT_KEYS) raw[k] = Number(form.get(k));
  raw["invoice.series"] = String(raw["invoice.series"]).toUpperCase();
  const parsed = formSchema.safeParse(raw);
  if (!parsed.success) return { error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  await saveSettings(parsed.data as Partial<Settings>, user.id);
  return { ok: true };
}

export async function uploadLogoAction(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await assertStaff("settings.manage");
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "logoType" };
  if (!publicStorageConfigured()) return { error: "storage" };
  const ext = LOGO_TYPES[file.type as keyof typeof LOGO_TYPES];
  if (!ext) return { error: "logoType" };
  if (file.size > MAX_LOGO_BYTES) return { error: "logoSize" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (ext === "svg" && /<script|on\w+\s*=|javascript:/i.test(new TextDecoder().decode(bytes))) return { error: "logoType" };

  const previous = (await getSettings())["brand.logoKey"];
  const key = `brand/logo-${randomUUID()}.${ext}`;
  await putPublicObject(key, bytes, file.type);
  await saveSettings({ "brand.logoKey": key }, user.id);
  if (previous) await deletePublicObject(previous).catch(() => undefined);
  return { ok: true };
}

export async function resetLogoAction(): Promise<SettingsState> {
  const user = await assertStaff("settings.manage");
  const previous = (await getSettings())["brand.logoKey"];
  await saveSettings({ "brand.logoKey": null }, user.id);
  if (previous && publicStorageConfigured()) await deletePublicObject(previous).catch(() => undefined);
  return { ok: true };
}
