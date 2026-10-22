import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getBrand } from "@/server/settings";
import { driverLogoutAction } from "@/app/driver/actions";

export async function DriverHeader({ title, back, name }: { title?: string; back?: string; name?: string | null }) {
  const [t, brand] = await Promise.all([getTranslations("Driver"), getBrand()]);
  return (
    <header className="sticky top-0 z-20 bg-primary pt-[env(safe-area-inset-top)] text-primary-foreground">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2">
        {back ? (
          <Link href={back} className="grid size-12 place-items-center rounded-lg hover:bg-white/10" aria-label={t("back")}>
            <ArrowLeft aria-hidden className="size-6" />
          </Link>
        ) : (
          <span className="px-1 font-extrabold">{brand.name}</span>
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title ?? name}</h1>
        {!back && (
          <form action={driverLogoutAction}>
            <button type="submit" className="grid size-12 place-items-center rounded-lg hover:bg-white/10" aria-label={t("logout")}>
              <LogOut aria-hidden className="size-6" />
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
