import "server-only";
import { redirect } from "next/navigation";
import { auth } from "./config";
import { can, type Permission } from "./permissions";

export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`Missing permission: ${permission}`);
  }
}

/** For admin pages: redirects to login / 2FA when needed, returns the user. */
export async function requireStaff(permission?: Permission) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) redirect("/admin/login");
  if (user.mfa === "pending") redirect("/admin/2fa");
  if (user.mfa === "setup") redirect("/admin/2fa/setup");
  if (permission && !can(user.permissions, permission)) redirect("/admin?forbidden=1");
  return user;
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function assertStaff(permission?: Permission) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.mfa !== "ok") throw new ForbiddenError("session");
  if (permission && !can(user.permissions, permission)) throw new ForbiddenError(permission);
  return user;
}

/** For driver app pages: a signed-in user with a driver profile. */
export async function requireDriver() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) redirect("/admin/login");
  if (user.mfa === "pending") redirect("/admin/2fa");
  if (user.mfa === "setup") redirect("/admin/2fa/setup");
  if (!can(user.permissions, "driver.jobs")) redirect("/admin");
  return user;
}
