import { getBrand } from "@/server/settings";
import { Logo } from "@/components/shared/logo";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const brand = await getBrand();
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <Logo brand={brand} className="mb-6" />
        {children}
      </div>
    </main>
  );
}
