"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertStaff } from "@/server/auth/guard";
import { createRule, PricingError, saveDiscount, saveTariff, simulatePrice, updateRule } from "@/server/pricing/manage";
import type { PriceResult, PriceUnavailable } from "@/server/pricing/types";
import { ORIGIN_COUNTRIES, SERVICES, VEHICLE_TYPES } from "@/lib/validation/booking";
import { formReader } from "@/lib/form";
import { fromBusinessLocal } from "@/lib/time";

export type PricingState = { ok?: boolean; error?: string; fields?: string[] } | undefined;
export type SimState = { result?: PriceResult | PriceUnavailable; error?: string } | undefined;

const fail = (e: z.ZodError): PricingState => ({ error: "invalid", fields: [...new Set(e.issues.map((i) => String(i.path[0])))] });
/** "12,50" or "12.5" → 1250 (cents or basis points, both are ×100). */
const hundredths = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(",", ".").trim() : v),
  z.coerce.number().min(0).max(1_000_000).transform((n) => Math.round(n * 100)),
);
const optHundredths = z.preprocess((v) => (v === "" || v == null ? null : v), hundredths.nullable());
const hour = z.number().int().min(0).max(23).nullable();

function done(): PricingState {
  revalidatePath("/admin/pricing");
  return { ok: true };
}

async function guard<T>(fn: () => Promise<T>): Promise<PricingState | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    if (err instanceof PricingError) return { error: err.code };
    throw err;
  }
}

export async function updateRuleAction(_: PricingState, form: FormData): Promise<PricingState> {
  const user = await assertStaff("pricing.manage");
  const f = formReader(form);
  const parsed = z
    .object({ id: z.string().min(1), name: z.string().min(1).max(80), amount: hundredths, isActive: z.boolean(), fromHour: hour.optional(), toHour: hour.optional(), minKm: z.number().int().min(0).nullable().optional() })
    .safeParse({
      id: f.str("id"),
      name: f.str("name"),
      amount: f.str("amount"),
      isActive: f.bool("isActive"),
      fromHour: form.has("fromHour") ? f.int("fromHour") : undefined,
      toHour: form.has("toHour") ? f.int("toHour") : undefined,
      minKm: form.has("minKm") ? f.int("minKm") : undefined,
    });
  if (!parsed.success) return fail(parsed.error);
  const { id, ...rest } = parsed.data;
  return (await guard(() => updateRule(id, rest, user.id))) ?? done();
}

const TRIGGERS = ["always", "night", "weekend", "holiday", "non_drivable", "winch", "enclosed", "express", "highway", "customs", "export_plates"] as const;

export async function createRuleAction(_: PricingState, form: FormData): Promise<PricingState> {
  const user = await assertStaff("pricing.manage");
  const f = formReader(form);
  const parsed = z
    .object({
      name: z.string().min(2).max(80),
      kind: z.enum(["BASE_FEE", "PER_KM", "SURCHARGE_PERCENT", "SURCHARGE_FIXED", "MINIMUM_PRICE"]),
      amount: hundredths,
      service: z.enum(SERVICES).nullable(),
      vehicleType: z.enum(VEHICLE_TYPES).nullable(),
      trigger: z.enum(TRIGGERS).nullable(),
    })
    .safeParse({ name: f.str("name"), kind: f.str("kind"), amount: f.str("amount"), service: f.opt("service"), vehicleType: f.opt("vehicleType"), trigger: f.opt("trigger") });
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  const isSurcharge = d.kind === "SURCHARGE_PERCENT" || d.kind === "SURCHARGE_FIXED";
  if (isSurcharge && !d.trigger) return { error: "invalid", fields: ["trigger"] };
  const key = `custom_${d.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30)}_${Date.now().toString(36)}`;
  await createRule(
    { key, name: d.name, kind: d.kind, amount: d.amount, service: d.service, vehicleType: d.vehicleType, conditions: isSurcharge ? { trigger: d.trigger! } : null, priority: 100, isActive: true },
    user.id,
  );
  return done();
}

const tariffSchema = z.object({
  fromCountry: z.enum(ORIGIN_COUNTRIES),
  fromCity: z.string().max(60).nullable(),
  toCountry: z.string().regex(/^[A-Z]{2}$/),
  toCity: z.string().max(60).nullable(),
  vehicleType: z.enum(VEHICLE_TYPES).nullable(),
  priceCents: hundredths,
  enclosedCents: optHundredths,
  transitDays: z.number().int().min(1).max(30).nullable(),
  includesCustoms: z.boolean(),
  isActive: z.boolean(),
});

export async function saveTariffAction(_: PricingState, form: FormData): Promise<PricingState> {
  const user = await assertStaff("pricing.manage");
  const f = formReader(form);
  const parsed = tariffSchema.safeParse({
    fromCountry: f.str("fromCountry"),
    fromCity: f.opt("fromCity"),
    toCountry: (f.str("toCountry") || "XK").toUpperCase(),
    toCity: f.opt("toCity"),
    vehicleType: f.opt("vehicleType"),
    priceCents: f.str("price"),
    enclosedCents: f.str("enclosedPrice"),
    transitDays: f.int("transitDays"),
    includesCustoms: f.bool("includesCustoms"),
    isActive: f.bool("isActive"),
  });
  if (!parsed.success) return fail(parsed.error);
  return (await guard(() => saveTariff(f.opt("id"), parsed.data, user.id))) ?? done();
}

export async function saveDiscountAction(_: PricingState, form: FormData): Promise<PricingState> {
  const user = await assertStaff("pricing.manage");
  const f = formReader(form);
  const parsed = z
    .object({
      code: z.string().regex(/^[A-Z0-9-]{3,30}$/),
      percentBp: optHundredths.refine((v) => v == null || v <= 10_000),
      fixedCents: optHundredths,
      maxUses: z.number().int().min(1).nullable(),
      validFrom: z.date().nullable(),
      validTo: z.date().nullable(),
      isActive: z.boolean(),
    })
    .refine((d) => (d.percentBp == null) !== (d.fixedCents == null), { path: ["percentBp"] })
    .safeParse({
      code: f.str("code").toUpperCase(),
      percentBp: f.str("percent"),
      fixedCents: f.str("fixed"),
      maxUses: f.int("maxUses"),
      validFrom: f.str("validFrom") ? fromBusinessLocal(`${f.str("validFrom")}T00:00`) : null,
      validTo: f.expiry("validTo"),
      isActive: f.bool("isActive"),
    });
  if (!parsed.success) return fail(parsed.error);
  return (await guard(() => saveDiscount(f.opt("id"), parsed.data, user.id))) ?? done();
}

export async function simulateAction(_: SimState, form: FormData): Promise<SimState> {
  await assertStaff("pricing.read");
  const f = formReader(form);
  const parsed = z
    .object({
      service: z.enum(SERVICES),
      vehicleType: z.enum(VEHICLE_TYPES),
      distanceKm: z.number().min(0).max(5000),
      isDrivable: z.boolean(),
      pickupAt: z.date().nullable(),
      fromCountry: z.enum(ORIGIN_COUNTRIES),
      fromCity: z.string().nullable(),
      options: z.object({ enclosed: z.boolean(), express: z.boolean(), winch: z.boolean(), highway: z.boolean(), customs: z.boolean(), exportPlates: z.boolean() }),
    })
    .safeParse({
      service: f.str("service"),
      vehicleType: f.str("vehicleType"),
      distanceKm: Number(f.str("distanceKm").replace(",", ".") || 0),
      isDrivable: f.bool("isDrivable"),
      pickupAt: f.local("pickupAt"),
      fromCountry: f.str("fromCountry") || "DE",
      fromCity: f.opt("fromCity"),
      options: { enclosed: f.bool("enclosed"), express: f.bool("express"), winch: f.bool("winch"), highway: f.bool("highway"), customs: f.bool("customs"), exportPlates: f.bool("exportPlates") },
    });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;
  const result = await simulatePrice({
    service: d.service,
    vehicleType: d.vehicleType,
    distanceKm: d.distanceKm,
    isDrivable: d.isDrivable,
    pickupAt: d.pickupAt,
    options: d.options,
    international: d.service === "INTERNATIONAL_TRANSPORT" ? { fromCountry: d.fromCountry, fromCity: d.fromCity, toCountry: "XK" } : undefined,
  });
  return { result };
}
