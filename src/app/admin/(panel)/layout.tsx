import { redirect } from "next/navigation";
import { requireStaff } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { getBrand } from "@/server/settings";
import { AdminShell } from "@/components/admin/shell";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const [user, brand] = await Promise.all([requireStaff(), getBrand()]);
  // Drivers work in the driver app; the office screens are not for them.
  if (can(user.permissions, "driver.jobs") && !can(user.permissions, "orders.read")) redirect("/driver");
  return (
    <AdminShell user={user} brand={brand}>
      {children}
    </AdminShell>
  );
}
