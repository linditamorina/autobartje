import "server-only";
import { hash } from "@node-rs/argon2";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

export const TRUCK_KINDS = ["flatbed", "wheel-lift", "car carrier", "enclosed"] as const;
export const LICENSE_CATEGORIES = ["B", "C", "C1", "CE", "C1E"] as const;

export class FleetError extends Error {
  constructor(public code: "plate_taken" | "email_taken" | "not_found" | "has_jobs") {
    super(code);
  }
}

export interface TruckInput {
  plate: string;
  name: string | null;
  kind: (typeof TRUCK_KINDS)[number];
  capacityVehicles: number;
  maxWeightKg: number | null;
  hasWinch: boolean;
  isEnclosed: boolean;
  isActive: boolean;
  registrationExpires: Date | null;
  insuranceExpires: Date | null;
  inspectionExpires: Date | null;
  nextServiceAt: Date | null;
  nextServiceKm: number | null;
  odometerKm: number | null;
}

export async function saveTruck(id: string | null, input: TruckInput, actorId: string) {
  return db.$transaction(async (tx) => {
    const clash = await tx.truck.findFirst({ where: { plate: input.plate, ...(id ? { id: { not: id } } : {}) } });
    if (clash) throw new FleetError("plate_taken");
    const before = id ? await tx.truck.findUnique({ where: { id } }) : null;
    if (id && !before) throw new FleetError("not_found");
    const truck = id ? await tx.truck.update({ where: { id }, data: input }) : await tx.truck.create({ data: input });
    await audit(tx, { actorId, action: id ? "truck.updated" : "truck.created", entityType: "Truck", entityId: truck.id, before: before ?? undefined, after: input });
    return truck;
  });
}

export interface DriverInput {
  name: string;
  email: string;
  phone: string | null;
  locale: "sq" | "en" | "de" | "sr";
  password: string | null;
  licenseNumber: string | null;
  licenseCategory: (typeof LICENSE_CATEGORIES)[number];
  licenseExpires: Date;
  cpcExpires: Date | null;
  isActive: boolean;
}

/** A driver is a user with the DRIVER role plus licence data. Deactivating also signs them out. */
export async function saveDriver(id: string | null, input: DriverInput, actorId: string) {
  const passwordHash = input.password ? await hash(input.password) : undefined;
  return db.$transaction(async (tx) => {
    const existing = id ? await tx.driver.findUnique({ where: { id }, include: { user: true } }) : null;
    if (id && !existing) throw new FleetError("not_found");
    const emailOwner = await tx.user.findUnique({ where: { email: input.email } });
    if (emailOwner && emailOwner.id !== existing?.userId) throw new FleetError("email_taken");

    const userData = {
      name: input.name,
      email: input.email,
      phone: input.phone,
      locale: input.locale,
      isActive: input.isActive,
      ...(passwordHash ? { passwordHash } : {}),
    };
    const driverData = {
      licenseNumber: input.licenseNumber,
      licenseCategory: input.licenseCategory,
      licenseExpires: input.licenseExpires,
      cpcExpires: input.cpcExpires,
      isActive: input.isActive,
    };

    let driverId: string;
    if (existing) {
      const revoke = (existing.user.isActive && !input.isActive) || Boolean(passwordHash);
      await tx.user.update({ where: { id: existing.userId }, data: { ...userData, ...(revoke ? { tokenVersion: { increment: 1 } } : {}) } });
      await tx.driver.update({ where: { id: existing.id }, data: driverData });
      driverId = existing.id;
    } else {
      const role = await tx.role.findUniqueOrThrow({ where: { key: "DRIVER" } });
      const user = await tx.user.create({ data: { ...userData, roleId: role.id } });
      driverId = (await tx.driver.create({ data: { ...driverData, userId: user.id } })).id;
    }
    const { password: _omit, ...logged } = input;
    void _omit;
    await audit(tx, {
      actorId,
      action: existing ? "driver.updated" : "driver.created",
      entityType: "Driver",
      entityId: driverId,
      before: existing ? { name: existing.user.name, email: existing.user.email, isActive: existing.isActive, licenseExpires: existing.licenseExpires } : undefined,
      after: { ...logged, passwordChanged: Boolean(passwordHash) },
    });
    return driverId;
  });
}

export async function addShift(input: { driverId: string; startsAt: Date; endsAt: Date; isOnCall: boolean; note: string | null }, actorId: string) {
  return db.$transaction(async (tx) => {
    const shift = await tx.driverShift.create({ data: input });
    await audit(tx, { actorId, action: "shift.created", entityType: "Driver", entityId: input.driverId, after: input });
    return shift;
  });
}

export async function deleteShift(id: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const shift = await tx.driverShift.delete({ where: { id } });
    await audit(tx, { actorId, action: "shift.deleted", entityType: "Driver", entityId: shift.driverId, before: shift });
    return shift;
  });
}
