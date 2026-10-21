"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertStaff } from "@/server/auth/guard";
import { addShift, deleteShift, FleetError, LICENSE_CATEGORIES, saveDriver, saveTruck, TRUCK_KINDS } from "@/server/fleet/manage";
import { phoneSchema } from "@/lib/validation/booking";
import { formReader } from "@/lib/form";

export type FleetState = { ok?: boolean; error?: string; fields?: string[] } | undefined;

const issues = (e: z.ZodError): FleetState => ({ error: "invalid", fields: [...new Set(e.issues.map((i) => String(i.path[0])))] });

const truckSchema = z.object({
  plate: z.string().min(2).max(20).transform((s) => s.toUpperCase()),
  name: z.string().max(60).nullable(),
  kind: z.enum(TRUCK_KINDS),
  capacityVehicles: z.number().int().min(1).max(10),
  maxWeightKg: z.number().int().min(0).max(60_000).nullable(),
  hasWinch: z.boolean(),
  isEnclosed: z.boolean(),
  isActive: z.boolean(),
  registrationExpires: z.date().nullable(),
  insuranceExpires: z.date().nullable(),
  inspectionExpires: z.date().nullable(),
  nextServiceAt: z.date().nullable(),
  nextServiceKm: z.number().int().min(0).nullable(),
  odometerKm: z.number().int().min(0).nullable(),
});

export async function saveTruckAction(_: FleetState, form: FormData): Promise<FleetState> {
  const user = await assertStaff("fleet.manage");
  const f = formReader(form);
  const id = f.opt("id");
  const parsed = truckSchema.safeParse({
    plate: f.str("plate"),
    name: f.opt("name"),
    kind: f.str("kind"),
    capacityVehicles: f.int("capacityVehicles") ?? 1,
    maxWeightKg: f.int("maxWeightKg"),
    hasWinch: f.bool("hasWinch"),
    isEnclosed: f.bool("isEnclosed"),
    isActive: f.bool("isActive"),
    registrationExpires: f.expiry("registrationExpires"),
    insuranceExpires: f.expiry("insuranceExpires"),
    inspectionExpires: f.expiry("inspectionExpires"),
    nextServiceAt: f.expiry("nextServiceAt"),
    nextServiceKm: f.int("nextServiceKm"),
    odometerKm: f.int("odometerKm"),
  });
  if (!parsed.success) return issues(parsed.error);
  try {
    await saveTruck(id, parsed.data, user.id);
  } catch (err) {
    if (err instanceof FleetError) return { error: err.code, fields: err.code === "plate_taken" ? ["plate"] : [] };
    throw err;
  }
  revalidatePath("/admin/fleet");
  redirect("/admin/fleet");
}

const driverSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.email().transform((s) => s.toLowerCase()),
  phone: phoneSchema.nullable(),
  locale: z.enum(["sq", "en", "de", "sr"]),
  password: z.string().min(10).max(200).nullable(),
  licenseNumber: z.string().max(40).nullable(),
  licenseCategory: z.enum(LICENSE_CATEGORIES),
  licenseExpires: z.date(),
  cpcExpires: z.date().nullable(),
  isActive: z.boolean(),
});

export async function saveDriverAction(_: FleetState, form: FormData): Promise<FleetState> {
  const user = await assertStaff("fleet.manage");
  const f = formReader(form);
  const id = f.opt("id");
  const parsed = driverSchema.safeParse({
    name: f.str("name"),
    email: f.str("email"),
    phone: f.opt("phone"),
    locale: f.str("locale") || "sq",
    password: f.opt("password"),
    licenseNumber: f.opt("licenseNumber"),
    licenseCategory: f.str("licenseCategory"),
    licenseExpires: f.expiry("licenseExpires"),
    cpcExpires: f.expiry("cpcExpires"),
    isActive: f.bool("isActive"),
  });
  if (!parsed.success) return issues(parsed.error);
  let driverId: string;
  try {
    driverId = await saveDriver(id, parsed.data, user.id);
  } catch (err) {
    if (err instanceof FleetError) return { error: err.code, fields: err.code === "email_taken" ? ["email"] : [] };
    throw err;
  }
  revalidatePath("/admin/fleet");
  if (!id) redirect(`/admin/fleet/drivers/${driverId}`);
  return { ok: true };
}

export async function addShiftAction(_: FleetState, form: FormData): Promise<FleetState> {
  const user = await assertStaff("fleet.manage");
  const f = formReader(form);
  const startsAt = f.local("startsAt");
  const endsAt = f.local("endsAt");
  const driverId = f.str("driverId");
  if (!driverId || !startsAt || !endsAt || endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 48 * 3_600_000) return { error: "invalid", fields: ["endsAt"] };
  await addShift({ driverId, startsAt, endsAt, isOnCall: f.bool("isOnCall"), note: f.opt("note") }, user.id);
  revalidatePath(`/admin/fleet/drivers/${driverId}`);
  revalidatePath("/admin/dispatch");
  return { ok: true };
}

export async function deleteShiftAction(form: FormData): Promise<void> {
  const user = await assertStaff("fleet.manage");
  const shift = await deleteShift(String(form.get("shiftId")), user.id);
  revalidatePath(`/admin/fleet/drivers/${shift.driverId}`);
  revalidatePath("/admin/dispatch");
}
