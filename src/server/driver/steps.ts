import type { OrderStatus } from "@/server/orders/status";

export type InspectionKind = "PICKUP" | "DELIVERY";
export type DriverAction = "start" | "picked_up" | "arrived" | "on_the_way" | "delivered" | "done";
export type JobStep = { to: OrderStatus; action: DriverAction; needs?: InspectionKind };

/** Photos the driver must take at pickup and delivery: the car from all four sides. */
export const REQUIRED_ANGLES = ["FRONT", "REAR", "LEFT", "RIGHT"] as const;
export const PHOTO_ANGLES = ["FRONT", "REAR", "LEFT", "RIGHT", "ODOMETER", "INTERIOR", "DAMAGE", "OTHER"] as const;
export type DriverPhotoAngle = (typeof PHOTO_ANGLES)[number];

/**
 * The one button the driver sees next. Roadside help is finished on the spot,
 * so it has no transport leg and no inspections.
 */
export function nextDriverStep(status: OrderStatus, service: string): JobStep | null {
  const roadside = service === "ROADSIDE_ASSISTANCE";
  switch (status) {
    case "CONFIRMED":
      return { to: "DRIVER_EN_ROUTE", action: "start" };
    case "DRIVER_EN_ROUTE":
      return roadside ? { to: "PICKED_UP", action: "arrived" } : { to: "PICKED_UP", action: "picked_up", needs: "PICKUP" };
    case "PICKED_UP":
      return roadside ? { to: "DELIVERED", action: "done" } : { to: "IN_TRANSIT", action: "on_the_way" };
    case "IN_TRANSIT":
      return { to: "DELIVERED", action: "delivered", needs: "DELIVERY" };
    default:
      return null;
  }
}

/** Which inspection the driver may work on in this status. */
export function inspectionOpen(status: OrderStatus, kind: InspectionKind): boolean {
  return kind === "PICKUP" ? status === "DRIVER_EN_ROUTE" || status === "PICKED_UP" : status === "PICKED_UP" || status === "IN_TRANSIT";
}

export function missingForInspection(insp: { photos: { angle: string }[]; signedAt: Date | string | null } | undefined, kind: InspectionKind): { angles: string[]; signature: boolean } {
  const taken = new Set(insp?.photos.map((p) => p.angle) ?? []);
  return { angles: REQUIRED_ANGLES.filter((a) => !taken.has(a)), signature: kind === "DELIVERY" && !insp?.signedAt };
}

export function inspectionComplete(insp: Parameters<typeof missingForInspection>[0], kind: InspectionKind): boolean {
  const m = missingForInspection(insp, kind);
  return m.angles.length === 0 && !m.signature;
}
