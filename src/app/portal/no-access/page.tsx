import { getTranslations } from "next-intl/server";
import { portalLogoutAction } from "@/app/portal/actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "No access" };

export default async function NoAccessPage() {
  const t = await getTranslations("Portal");
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-16">
      <h1 className="text-2xl font-extrabold">{t("noAccessTitle")}</h1>
      <p>{t("noAccessText")}</p>
      <form action={portalLogoutAction}><Button type="submit" variant="outline">{t("logout")}</Button></form>
    </main>
  );
}
