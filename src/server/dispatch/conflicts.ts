/**
 * Checks a planned assignment (driver + truck + time slot) before it is saved.
 * Pure function so the rules are unit tested; the caller loads the data.
 *
 * "block" problems stop the assignment; "warn" problems need the dispatcher to
 * confirm ("assign anyway").
 */
export type ConflictCode =
  | "invalid_slot"
  | "driver_inactive"
  | "driver_busy"
  | "license_expired"
  | "cpc_expired"
  | "truck_inactive"
  | "truck_full"
  | "insurance_expired"
  | "registration_expired"
  | "inspection_expired"
  | "service_due"
  | "needs_enclosed"
  | "needs_winch";

export type Conflict = { code: ConflictCode; severity: "block" | "warn"; ref?: string };

export interface SlotInput {
  start: Date;
  end: Date;
  orderOptions: { enclosed?: boolean; winch?: boolean };
  isDrivable: boolean | null;
  driver: { isActive: boolean; licenseExpires: Date; cpcExpires: Date | null };
  truck: {
    id: string;
    isActive: boolean;
    capacityVehicles: number;
    hasWinch: boolean;
    isEnclosed: boolean;
    insuranceExpires: Date | null;
    registrationExpires: Date | null;
    inspectionExpires: Date | null;
    nextServiceAt: Date | null;
  };
  /** Other active assignments of this driver or truck (any order but this one). */
  existing: { orderNumber: string; driverId: string; truckId: string; start: Date; end: Date }[];
  driverId: string;
}

const overlaps = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) => a.start < b.end && b.start < a.end;

export function findConflicts(i: SlotInput): Conflict[] {
  const out: Conflict[] = [];
  if (!(i.end > i.start)) return [{ code: "invalid_slot", severity: "block" }];

  if (!i.driver.isActive) out.push({ code: "driver_inactive", severity: "block" });
  if (i.driver.licenseExpires < i.end) out.push({ code: "license_expired", severity: "block" });
  if (i.driver.cpcExpires && i.driver.cpcExpires < i.end) out.push({ code: "cpc_expired", severity: "block" });

  if (!i.truck.isActive) out.push({ code: "truck_inactive", severity: "block" });
  if (i.truck.insuranceExpires && i.truck.insuranceExpires < i.end) out.push({ code: "insurance_expired", severity: "block" });
  if (i.truck.registrationExpires && i.truck.registrationExpires < i.end) out.push({ code: "registration_expired", severity: "block" });
  if (i.truck.inspectionExpires && i.truck.inspectionExpires < i.end) out.push({ code: "inspection_expired", severity: "block" });
  if (i.truck.nextServiceAt && i.truck.nextServiceAt < i.end) out.push({ code: "service_due", severity: "warn" });

  if (i.orderOptions.enclosed && !i.truck.isEnclosed) out.push({ code: "needs_enclosed", severity: "warn" });
  if ((i.orderOptions.winch || i.isDrivable === false) && !i.truck.hasWinch) out.push({ code: "needs_winch", severity: "warn" });

  const clashing = i.existing.filter((e) => overlaps(e, i));
  // A car carrier loads several vehicles on one trip: same driver on the same truck is fine up to capacity.
  const onTruck = clashing.filter((e) => e.truckId === i.truck.id);
  if (onTruck.length >= i.truck.capacityVehicles) out.push({ code: "truck_full", severity: "block", ref: onTruck.map((e) => e.orderNumber).join(", ") });
  const driverElsewhere = clashing.filter((e) => e.driverId === i.driverId && e.truckId !== i.truck.id);
  if (driverElsewhere.length) out.push({ code: "driver_busy", severity: "block", ref: driverElsewhere.map((e) => e.orderNumber).join(", ") });

  return out;
}

/** Default slot length when the dispatcher does not set an end: towing is short, transport is long. */
export function defaultDurationMin(service: string, durationMin: number | null): number {
  const drive = durationMin ?? 0;
  if (service === "ROADSIDE_ASSISTANCE") return Math.max(60, drive * 2 + 30);
  if (service === "INTERNATIONAL_TRANSPORT") return 3 * 24 * 60;
  return Math.max(90, Math.ceil((drive * 2 + 45) / 15) * 15);
}
