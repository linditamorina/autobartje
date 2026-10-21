"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertStaff } from "@/server/auth/guard";
import { addContractPrice, addPortalUser, COMPANY_TYPES, CompanyError, deleteContractPrice, saveCompany, setPortalUserActive } from "@/server/companies/manage";
import { createMonthlyInvoice } from "@/server/invoicing/monthly";
import { InvoiceError } from "@/server/invoicing/manage";
import { phoneSchema, SERVICES, VEHICLE_TYPES } from "@/lib/validation/booking";
import { formReader } from "@/lib/form";
import { createApiKey, revokeApiKey } from "@/server/partner/keys";
import { createWebhook, deleteWebhook, enableWebhook, sendTestEvent, WebhookError } from "@/server/partner/webhooks";
import { kickOutbox } from "@/server/notifications/kick";
import { eurToCents } from "@/lib/money";
import { fromBusinessLocal } from "@/lib/time";

export type CustomerState = { ok?: boolean; error?: string; fields?: string[] } | undefined;

const fieldsOf = (e: z.ZodError) => [...new Set(e.issues.map((i) => String(i.path[0])))];

const companySchema = z.object({
  name: z.string().min(2).max(150),
  type: z.enum(COMPANY_TYPES),
  nui: z.string().regex(/^\d{8,10}$/).nullable(),
  vatNumber: z.string().max(30).nullable(),
  address: z.string().max(200).nullable(),
  city: z.string().max(100).nullable(),
  billingEmail: z.email().nullable(),
  paymentTermsDays: z.number().int().min(0).max(120),
  monthlyInvoicing: z.boolean(),
  isActive: z.boolean(),
});

export async function saveCompanyAction(_: CustomerState, form: FormData): Promise<CustomerState> {
  const actor = await assertStaff("customers.manage");
  const f = formReader(form);
  const id = f.opt("id");
  const parsed = companySchema.safeParse({
    name: f.str("name"), type: f.str("type"), nui: f.opt("nui"), vatNumber: f.opt("vatNumber"), address: f.opt("address"), city: f.opt("city"),
    billingEmail: f.opt("billingEmail")?.toLowerCase() ?? null, paymentTermsDays: f.int("paymentTermsDays") ?? 30, monthlyInvoicing: f.bool("monthlyInvoicing"), isActive: f.bool("isActive"),
  });
  if (!parsed.success) return { error: "invalid", fields: fieldsOf(parsed.error) };
  let companyId: string;
  try {
    companyId = (await saveCompany(id, parsed.data, actor.id)).id;
  } catch (err) {
    if (err instanceof CompanyError) return { error: err.code, fields: err.code === "nui_taken" ? ["nui"] : [] };
    throw err;
  }
  revalidatePath("/admin/customers");
  if (!id) redirect(`/admin/customers/${companyId}`);
  return { ok: true };
}

/** Euro amount from a form field ("12,50" or "12.50"), as cents. */
const eur = (v: string | null) => (v == null ? null : Number.isFinite(Number(v.replace(",", "."))) ? eurToCents(Number(v.replace(",", "."))) : NaN);

const contractSchema = z
  .object({
    service: z.enum(SERVICES),
    vehicleType: z.enum(VEHICLE_TYPES).nullable(),
    baseCents: z.number().int().min(0).max(10_000_000).nullable(),
    perKmCents: z.number().int().min(0).max(100_000).nullable(),
    discountBp: z.number().int().min(0).max(10_000).nullable(),
    validFrom: z.date(),
    validTo: z.date().nullable(),
  })
  .refine((c) => c.baseCents != null || c.perKmCents != null || c.discountBp != null, { path: ["baseCents"] })
  .refine((c) => !c.validTo || c.validTo > c.validFrom, { path: ["validTo"] });

export async function addContractAction(_: CustomerState, form: FormData): Promise<CustomerState> {
  const actor = await assertStaff("customers.manage");
  const f = formReader(form);
  const companyId = f.str("companyId");
  const pct = f.opt("discountPct");
  const parsed = contractSchema.safeParse({
    service: f.str("service"),
    vehicleType: f.opt("vehicleType"),
    baseCents: eur(f.opt("baseEur")),
    perKmCents: eur(f.opt("perKmEur")),
    discountBp: pct == null ? null : Math.round(Number(pct.replace(",", ".")) * 100),
    validFrom: (f.opt("validFrom") ? fromBusinessLocal(`${f.str("validFrom")}T00:00`) : null) ?? new Date(),
    validTo: f.expiry("validTo"),
  });
  if (!parsed.success) {
    const map: Record<string, string> = { baseCents: "baseEur", perKmCents: "perKmEur", discountBp: "discountPct" };
    return { error: "invalid", fields: fieldsOf(parsed.error).map((k) => map[k] ?? k) };
  }
  await addContractPrice(companyId, parsed.data, actor.id);
  revalidatePath(`/admin/customers/${companyId}`);
  return { ok: true };
}

export async function deleteContractAction(_: CustomerState, form: FormData): Promise<CustomerState> {
  const actor = await assertStaff("customers.manage");
  await deleteContractPrice(String(form.get("id")), actor.id);
  revalidatePath(`/admin/customers/${String(form.get("companyId"))}`);
  return { ok: true };
}

const portalUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.email().transform((s) => s.toLowerCase()),
  phone: phoneSchema.nullable(),
  locale: z.enum(["sq", "en", "de"]),
  password: z.string().min(12).max(200),
});

export async function addPortalUserAction(_: CustomerState, form: FormData): Promise<CustomerState> {
  const actor = await assertStaff("customers.manage");
  const f = formReader(form);
  const companyId = f.str("companyId");
  const parsed = portalUserSchema.safeParse({ name: f.str("name"), email: f.str("email"), phone: f.opt("phone"), locale: f.str("locale") || "sq", password: f.str("password") });
  if (!parsed.success) return { error: "invalid", fields: fieldsOf(parsed.error) };
  try {
    await addPortalUser(companyId, parsed.data, actor.id);
  } catch (err) {
    if (err instanceof CompanyError) return { error: err.code, fields: err.code === "email_taken" ? ["email"] : [] };
    throw err;
  }
  revalidatePath(`/admin/customers/${companyId}`);
  return { ok: true };
}

export async function togglePortalUserAction(_: CustomerState, form: FormData): Promise<CustomerState> {
  const actor = await assertStaff("customers.manage");
  await setPortalUserActive(String(form.get("userId")), form.get("active") === "1", actor.id);
  revalidatePath(`/admin/customers/${String(form.get("companyId"))}`);
  return { ok: true };
}

export async function monthlyInvoiceAction(_: CustomerState, form: FormData): Promise<CustomerState> {
  const actor = await assertStaff("invoices.issue");
  let invoiceId: string;
  try {
    invoiceId = (await createMonthlyInvoice(String(form.get("companyId")), String(form.get("month")), actor.id)).id;
  } catch (err) {
    if (err instanceof InvoiceError) return { error: err.code };
    throw err;
  }
  redirect(`/admin/invoices/${invoiceId}`);
}

// Partner API: keys and webhooks give a company's systems access, so only Owner and Admin manage them.

export type SecretState = { ok?: boolean; error?: string; secret?: string } | undefined;

export async function createApiKeyAction(_: SecretState, form: FormData): Promise<SecretState> {
  const actor = await assertStaff("settings.manage");
  const f = formReader(form);
  const name = f.str("name").trim();
  if (name.length < 2 || name.length > 60) return { error: "invalid" };
  const { key } = await createApiKey(f.str("companyId"), name, actor.id);
  revalidatePath(`/admin/customers/${f.str("companyId")}`);
  return { ok: true, secret: key };
}

export async function revokeApiKeyAction(_: CustomerState, form: FormData): Promise<CustomerState> {
  const actor = await assertStaff("settings.manage");
  const f = formReader(form);
  await revokeApiKey(f.str("companyId"), f.str("id"), actor.id);
  revalidatePath(`/admin/customers/${f.str("companyId")}`);
  return { ok: true };
}

export async function addWebhookAction(_: SecretState, form: FormData): Promise<SecretState> {
  const actor = await assertStaff("settings.manage");
  const f = formReader(form);
  try {
    const { secret } = await createWebhook(f.str("companyId"), { url: f.str("url").trim(), events: form.getAll("events").map(String) }, actor.id);
    revalidatePath(`/admin/customers/${f.str("companyId")}`);
    return { ok: true, secret };
  } catch (err) {
    if (err instanceof WebhookError) return { error: err.code };
    throw err;
  }
}

export async function webhookAction(_: CustomerState, form: FormData): Promise<CustomerState> {
  const actor = await assertStaff("settings.manage");
  const f = formReader(form);
  const companyId = f.str("companyId");
  const id = f.str("id");
  try {
    const op = f.str("op");
    if (op === "delete") await deleteWebhook(companyId, id, actor.id);
    else if (op === "enable") await enableWebhook(companyId, id);
    else if (op === "test") {
      await sendTestEvent(companyId, id);
      kickOutbox();
    } else return { error: "invalid" };
  } catch (err) {
    if (err instanceof WebhookError) return { error: err.code };
    throw err;
  }
  revalidatePath(`/admin/customers/${companyId}`);
  return { ok: true };
}
