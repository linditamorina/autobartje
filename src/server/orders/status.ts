export const ORDER_STATUSES = [
  "DRAFT",
  "RECEIVED",
  "CONFIRMED",
  "DRIVER_EN_ROUTE",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Columns of the admin kanban, in order. */
export const BOARD_STATUSES: OrderStatus[] = ["RECEIVED", "CONFIRMED", "DRIVER_EN_ROUTE", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["RECEIVED", "CANCELLED"],
  RECEIVED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["DRIVER_EN_ROUTE", "RECEIVED", "CANCELLED"],
  DRIVER_EN_ROUTE: ["PICKED_UP", "CONFIRMED", "CANCELLED"],
  // Roadside help is finished on the spot, so PICKED_UP may go straight to DELIVERED.
  PICKED_UP: ["IN_TRANSIT", "DELIVERED"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: ["RECEIVED"],
};

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return NEXT[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT[from].includes(to);
}

/** Customer-facing message for each status change (see notifications). */
export const STATUS_NOTIFICATION: Partial<Record<OrderStatus, "booking_confirmed" | "driver_en_route" | "picked_up" | "delivered">> = {
  CONFIRMED: "booking_confirmed",
  DRIVER_EN_ROUTE: "driver_en_route",
  PICKED_UP: "picked_up",
  DELIVERED: "delivered",
};

export function isOpen(status: OrderStatus): boolean {
  return !["DELIVERED", "COMPLETED", "CANCELLED", "DRAFT"].includes(status);
}
