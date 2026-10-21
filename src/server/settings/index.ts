import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { DEFAULT_SETTINGS, settingsSchema, type SettingKey, type Settings } from "./defaults";

export { DEFAULT_SETTINGS, settingsSchema, type SettingKey, type Settings };

export const SETTINGS_TAG = "settings";

async function loadSettings(): Promise<Settings> {
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  try {
    const rows = await db.setting.findMany();
    for (const row of rows) {
      const field = settingsSchema.shape[row.key as SettingKey];
      if (!field) continue;
      const parsed = field.safeParse(row.value);
      if (parsed.success) merged[row.key] = parsed.data;
    }
  } catch (err) {
    // Database unavailable (e.g. during a static build): serve defaults.
    console.warn("[settings] falling back to defaults:", (err as Error).message);
  }
  return merged as Settings;
}

export const getSettings = unstable_cache(loadSettings, ["settings"], { tags: [SETTINGS_TAG], revalidate: 300 });

export interface Brand {
  name: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
}

export async function getBrand(): Promise<Brand> {
  const s = await getSettings();
  return {
    name: s["brand.name"],
    tagline: s["brand.tagline"],
    logoUrl: s["brand.logoKey"] ? publicAssetUrl(s["brand.logoKey"]) : "/brand/logo.svg",
    primaryColor: s["brand.primaryColor"],
  };
}

/** Site images (logo, fleet photos) live in the public R2 bucket. */
export function publicAssetUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "") ?? "";
  return `${base}/${key}`;
}
