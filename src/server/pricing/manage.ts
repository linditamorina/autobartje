import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { getSettings } from "@/server/settings";
import { calculatePrice } from "./engine";
import type { PricingInput, PricingRule, RouteTariff, RuleConditions } from "./types";
import type { Prisma } from "@/generated/prisma/client";

export class PricingError extends Error {
  constructor(public code: "not_found" | "duplicate") {
    super(code);
  }
}

export interface RuleUpdate {
  name: string;
  amount: number;
  isActive: boolean;
  fromHour?: number | null;
  toHour?: number | null;
  minKm?: number | null;
}

export async function updateRule(id: string, u: RuleUpdate, actorId: string) {
  return db.$transaction(async (tx) => {
    const before = await tx.pricingRule.findUnique({ where: { id } });
    if (!before) throw new PricingError("not_found");
    const conditions: RuleConditions = { ...((before.conditions as RuleConditions | null) ?? {}) };
    for (const k of ["fromHour", "toHour", "minKm"] as const) {
      if (u[k] === undefined) continue;
      if (u[k] === null) delete conditions[k];
      else conditions[k] = u[k];
    }
    const after = await tx.pricingRule.update({
      where: { id },
      data: { name: u.name, amount: u.amount, isActive: u.isActive, conditions: Object.keys(conditions).length ? (conditions as Prisma.InputJsonValue) : undefined },
    });
    await audit(tx, { actorId, action: "pricing.rule_updated", entityType: "PricingRule", entityId: id, before: { name: before.name, amount: before.amount, isActive: before.isActive, conditions: before.conditions }, after: { name: after.name, amount: after.amount, isActive: after.isActive, conditions: after.conditions } });
    return after;
  });
}

export async function createRule(r: Omit<PricingRule, "validFrom" | "validTo">, actorId: string) {
  return db.$transaction(async (tx) => {
    const created = await tx.pricingRule.create({ data: { ...r, conditions: (r.conditions ?? undefined) as Prisma.InputJsonValue | undefined } });
    await audit(tx, { actorId, action: "pricing.rule_created", entityType: "PricingRule", entityId: created.id, after: r });
    return created;
  });
}

export async function saveTariff(id: string | null, t: RouteTariff, actorId: string) {
  return db.$transaction(async (tx) => {
    const dup = await tx.routeTariff.findFirst({
      where: { fromCountry: t.fromCountry, fromCity: t.fromCity, toCountry: t.toCountry, toCity: t.toCity, vehicleType: t.vehicleType, ...(id ? { id: { not: id } } : {}) },
    });
    if (dup) throw new PricingError("duplicate");
    const before = id ? await tx.routeTariff.findUnique({ where: { id } }) : null;
    if (id && !before) throw new PricingError("not_found");
    const saved = id ? await tx.routeTariff.update({ where: { id }, data: t }) : await tx.routeTariff.create({ data: t });
    await audit(tx, { actorId, action: id ? "pricing.tariff_updated" : "pricing.tariff_created", entityType: "RouteTariff", entityId: saved.id, before: before ?? undefined, after: t });
    return saved;
  });
}

export interface DiscountInput {
  code: string;
  percentBp: number | null;
  fixedCents: number | null;
  maxUses: number | null;
  validFrom: Date | null;
  validTo: Date | null;
  isActive: boolean;
}

export async function saveDiscount(id: string | null, d: DiscountInput, actorId: string) {
  return db.$transaction(async (tx) => {
    const dup = await tx.discountCode.findFirst({ where: { code: d.code, ...(id ? { id: { not: id } } : {}) } });
    if (dup) throw new PricingError("duplicate");
    const before = id ? await tx.discountCode.findUnique({ where: { id } }) : null;
    if (id && !before) throw new PricingError("not_found");
    const saved = id ? await tx.discountCode.update({ where: { id }, data: d }) : await tx.discountCode.create({ data: d });
    await audit(tx, { actorId, action: id ? "pricing.discount_updated" : "pricing.discount_created", entityType: "DiscountCode", entityId: saved.id, before: before ?? undefined, after: d });
    return saved;
  });
}

/** Runs the live price list on a hand-entered trip, so the owner can check a change before customers see it. */
export async function simulatePrice(input: PricingInput) {
  const now = new Date();
  const [rules, tariffs, holidays, settings] = await Promise.all([
    db.pricingRule.findMany({ where: { isActive: true } }),
    db.routeTariff.findMany({ where: { isActive: true } }),
    db.holiday.findMany({ where: { date: { gte: new Date(now.getTime() - 864e5) } } }),
    getSettings(),
  ]);
  return calculatePrice(input, {
    rules: rules.map((r) => ({ ...r, conditions: (r.conditions as RuleConditions | null) ?? null })),
    routeTariffs: tariffs as RouteTariff[],
    holidays: holidays.map((h) => h.date.toISOString().slice(0, 10)),
    vatRateBp: settings["vat.rateBp"],
    now,
  });
}
