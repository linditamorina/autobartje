import { requireStaff } from "@/server/auth/guard";
import { getBrand } from "@/server/settings";
import { AdminShell } from "@/components/admin/shell";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const [user, brand] = await Promise.all([requireStaff(), getBrand()]);
  return (
    <AdminShell user={user} brand={brand}>
      {children}
    </AdminShell>
  );
}
