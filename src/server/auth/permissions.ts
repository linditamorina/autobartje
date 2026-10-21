/**
 * Permission strings checked with can(). Roles hold a list of these in the
 * database; "*" grants everything (Owner).
 */
export const PERMISSIONS = [
  "orders.read",
  "orders.create",
  "orders.update",
  "orders.assign",
  "orders.delete",
  "dispatch.read",
  "fleet.read",
  "fleet.manage",
  "pricing.read",
  "pricing.manage",
  "invoices.read",
  "invoices.issue",
  "payments.record",
  "customers.read",
  "customers.manage",
  "documents.read",
  "documents.manage",
  "reports.read",
  "cms.manage",
  "settings.manage",
  "users.manage",
  "audit.read",
  "privacy.manage",
  "driver.jobs",
  "portal.orders",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const SYSTEM_ROLES: { key: string; name: string; requires2fa: boolean; permissions: (Permission | "*")[] }[] = [
  { key: "OWNER", name: "Owner", requires2fa: true, permissions: ["*"] },
  {
    key: "ADMIN",
    name: "Admin",
    requires2fa: true,
    permissions: PERMISSIONS.filter((p) => p !== "driver.jobs" && p !== "portal.orders"),
  },
  {
    key: "DISPATCHER",
    name: "Dispatcher",
    requires2fa: false,
    permissions: ["orders.read", "orders.create", "orders.update", "orders.assign", "dispatch.read", "fleet.read", "pricing.read", "customers.read", "customers.manage", "documents.read", "documents.manage", "invoices.read"],
  },
  { key: "DRIVER", name: "Driver", requires2fa: false, permissions: ["driver.jobs", "payments.record"] },
  {
    key: "ACCOUNTANT",
    name: "Accountant",
    requires2fa: false,
    permissions: ["orders.read", "invoices.read", "invoices.issue", "payments.record", "customers.read", "reports.read", "documents.read"],
  },
  { key: "B2B_USER", name: "B2B customer", requires2fa: false, permissions: ["portal.orders"] },
];

export function can(granted: readonly string[], permission: Permission): boolean {
  return granted.includes("*") || granted.includes(permission);
}
