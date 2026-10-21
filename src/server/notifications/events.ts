export type NotificationEvent =
  | "booking_received"
  | "booking_confirmed"
  | "driver_assigned"
  | "driver_en_route"
  | "picked_up"
  | "delivered"
  | "invoice_issued"
  | "payment_received"
  | "review_request"
  | "admin_new_order"
  | "admin_fleet_expiry";

export type Channel = "SMS" | "WHATSAPP" | "EMAIL" | "PHONE";
