"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertStaff } from "@/server/auth/guard";
import { createInvoiceFromOrder, creditInvoice, InvoiceError, issueInvoice, recordPayment, updateDraft } from "@/server/invoicing/manage";
import { kickOutbox } from "@/server/notifications/kick";
import { formReader } from "@/lib/form";
import { fromBusinessLocal } from "@/lib/time";

export type InvoiceState = { ok?: boolean; error?: string; fields?: string[] } | undefined;

const cents = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(",", ".").trim() : v),
  z.coerce.number().min(-1_000_000).max(1_000_000).transform((n) => Math.round(n * 100)),
);

function fail(err: unknown): InvoiceState {
  if (err instanceof InvoiceError) return { error: err.code };
  throw err;
}

export async function createFromOrderAction(form: FormData): Promise<void> {
  const user = await assertStaff("invoices.issue");
  const orderId = String(form.get("orderId") ?? "");
  let id: string;
  try {
    id = (await createInvoiceFromOrder(orderId, user.id)).id;
  } catch (err) {
    if (err instanceof InvoiceError) redirect(`/admin/orders/${orderId}?invoiceError=${err.code}`);
    throw err;
  }
  redirect(`/admin/invoices/${id}`);
}

const lineSchema = z.object({ description: z.string().trim().min(2).max(300), quantity: z.coerce.number().positive().max(100_000), unit: z.string().trim().min(1).max(12), unitPriceCents: cents, vatRateBp: z.coerce.number().int().min(0).max(10_000) });

export async function saveDraftAction(_: InvoiceState, form: FormData): Promise<InvoiceState> {
  const user = await assertStaff("invoices.issue");
  const f = formReader(form);
  const count = Number(f.str("lineCount")) || 0;
  const lines = [];
  for (let i = 0; i < count; i++) {
    const desc = f.str(`line${i}.description`);
    if (!desc) continue; // empty rows are ignored
    const parsed = lineSchema.safeParse({
      description: desc,
      quantity: f.str(`line${i}.quantity`).replace(",", "."),
      unit: f.str(`line${i}.unit`) || "copë",
      unitPriceCents: f.str(`line${i}.unitPrice`),
      vatRateBp: Math.round(Number(f.str(`line${i}.vatRate`).replace(",", ".") || 18) * 100),
    });
    if (!parsed.success) return { error: "invalid", fields: parsed.error.issues.map((x) => `line${i}.${String(x.path[0]) === "unitPriceCents" ? "unitPrice" : String(x.path[0])}`) };
    lines.push(parsed.data);
  }
  const buyer = z
    .object({ name: z.string().min(2).max(150), nui: z.string().regex(/^\d{9}$/).nullable(), address: z.string().max(200).nullable(), city: z.string().max(80).nullable(), email: z.email().nullable(), phone: z.string().max(30).nullable() })
    .safeParse({ name: f.str("buyer.name"), nui: f.opt("buyer.nui"), address: f.opt("buyer.address"), city: f.opt("buyer.city"), email: f.opt("buyer.email"), phone: f.opt("buyer.phone") });
  if (!buyer.success) return { error: "invalid", fields: buyer.error.issues.map((x) => `buyer.${String(x.path[0])}`) };
  try {
    await updateDraft(f.str("id"), buyer.data, lines, f.bool("pricesIncludeVat"), user.id);
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/admin/invoices/${f.str("id")}`);
  return { ok: true };
}

export async function issueAction(_: InvoiceState, form: FormData): Promise<InvoiceState> {
  const user = await assertStaff("invoices.issue");
  const id = String(form.get("id"));
  try {
    await issueInvoice(id, user.id);
  } catch (err) {
    return fail(err);
  }
  kickOutbox();
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath("/admin/invoices");
  return { ok: true };
}

export async function creditAction(_: InvoiceState, form: FormData): Promise<InvoiceState> {
  const user = await assertStaff("invoices.issue");
  let creditId: string;
  try {
    creditId = (await creditInvoice(String(form.get("id")), user.id)).id;
  } catch (err) {
    return fail(err);
  }
  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices/${creditId}`);
}

export async function paymentAction(_: InvoiceState, form: FormData): Promise<InvoiceState> {
  const user = await assertStaff("payments.record");
  const f = formReader(form);
  const parsed = z
    .object({ amountCents: cents.refine((c) => c > 0), method: z.enum(["CASH", "CARD", "BANK_TRANSFER"]), receivedAt: z.date(), reference: z.string().max(80).nullable() })
    .safeParse({ amountCents: f.str("amount"), method: f.str("method"), receivedAt: fromBusinessLocal(`${f.str("receivedAt")}T12:00`), reference: f.opt("reference") });
  if (!parsed.success) return { error: "invalid", fields: parsed.error.issues.map((x) => (x.path[0] === "amountCents" ? "amount" : String(x.path[0]))) };
  try {
    await recordPayment(f.str("id"), parsed.data, user.id);
  } catch (err) {
    return fail(err);
  }
  kickOutbox();
  revalidatePath(`/admin/invoices/${f.str("id")}`);
  revalidatePath("/admin/invoices");
  return { ok: true };
}
