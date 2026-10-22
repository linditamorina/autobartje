import "server-only";
import { hash } from "@node-rs/argon2";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

export const COMPANY_TYPES = ["CAR_DEALER", "GARAGE", "INSURER", "LEASING", "OTHER"] as const;

export class CompanyError extends Error {
  constructor(public code: "not_found" | "nui_taken" | "email_taken") {
    super(code);
  }
}

export interface CompanyInput {
  name: string;
  type: (typeof COMPANY_TYPES)[number];
  nui: string | null;
  vatNumber: string | null;
  address: string | null;
  city: string | null;
  billingEmail: string | null;
  paymentTermsDays: number;
  monthlyInvoicing: boolean;
  isActive: boolean;
}

export async function saveCompany(id: string | null, input: CompanyInput, actorId: string) {
  return db.$transaction(async (tx) => {
    const existing = id ? await tx.company.findUnique({ where: { id } }) : null;
    if (id && !existing) throw new CompanyError("not_found");
    if (input.nui) {
      const clash = await tx.company.findUnique({ where: { nui: input.nui } });
      if (clash && clash.id !== id) throw new CompanyError("nui_taken");
    }
    const company = existing ? await tx.company.update({ where: { id: existing.id }, data: input }) : await tx.company.create({ data: input });
    await audit(tx, { actorId, action: existing ? "company.updated" : "company.created", entityType: "Company", entityId: company.id, after: input });
    // A deactivated company's portal users lose access at once.
    if (existing?.isActive && !input.isActive) await tx.user.updateMany({ where: { companyId: company.id }, data: { tokenVersion: { increment: 1 } } });
    return company;
  });
}

export interface ContractInput {
  service: "EMERGENCY_TOWING" | "ROADSIDE_ASSISTANCE" | "DOMESTIC_TRANSPORT" | "INTERNATIONAL_TRANSPORT";
  vehicleType: "CAR" | "SUV" | "VAN" | "MOTORCYCLE" | "LUXURY_LOW" | null;
  baseCents: number | null;
  perKmCents: number | null;
  discountBp: number | null;
  validFrom: Date;
  validTo: Date | null;
}

export async function addContractPrice(companyId: string, input: ContractInput, actorId: string) {
  return db.$transaction(async (tx) => {
    const c = await tx.contractPrice.create({ data: { companyId, ...input } });
    await audit(tx, { actorId, action: "contract_price.created", entityType: "Company", entityId: companyId, after: input });
    return c;
  });
}

export async function deleteContractPrice(id: string, actorId: string) {
  await db.$transaction(async (tx) => {
    const c = await tx.contractPrice.findUnique({ where: { id } });
    if (!c) return;
    await tx.contractPrice.delete({ where: { id } });
    await audit(tx, { actorId, action: "contract_price.deleted", entityType: "Company", entityId: c.companyId, before: c });
  });
}

export interface PortalUserInput {
  name: string;
  email: string;
  phone: string | null;
  locale: "sq" | "en" | "de";
  password: string;
}

/** A login for someone at the company. They see only their company's orders, invoices and prices. */
export async function addPortalUser(companyId: string, input: PortalUserInput, actorId: string) {
  const passwordHash = await hash(input.password);
  return db.$transaction(async (tx) => {
    if (!(await tx.company.findUnique({ where: { id: companyId } }))) throw new CompanyError("not_found");
    if (await tx.user.findUnique({ where: { email: input.email } })) throw new CompanyError("email_taken");
    const role = await tx.role.findUniqueOrThrow({ where: { key: "B2B_USER" } });
    const user = await tx.user.create({ data: { name: input.name, email: input.email, phone: input.phone, locale: input.locale, roleId: role.id, companyId, passwordHash } });
    await audit(tx, { actorId, action: "portal_user.created", entityType: "User", entityId: user.id, after: { companyId, email: input.email } });
    return user;
  });
}

export async function setPortalUserActive(userId: string, isActive: boolean, actorId: string) {
  await db.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!u || u.role.key !== "B2B_USER") throw new CompanyError("not_found");
    await tx.user.update({ where: { id: userId }, data: { isActive, ...(isActive ? {} : { tokenVersion: { increment: 1 } }) } });
    await audit(tx, { actorId, action: isActive ? "portal_user.activated" : "portal_user.deactivated", entityType: "User", entityId: userId });
  });
}
