import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/server/auth/config";
import { TotpForm } from "@/components/admin/auth-forms";

export default async function TwoFactorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");
  if (session.user.mfa === "ok") redirect("/admin");
  if (session.user.mfa === "setup") redirect("/admin/2fa/setup");
  const t = await getTranslations("Admin.twofa");
  return (
    <>
      <h1 className="mb-2 text-2xl font-extrabold">{t("title")}</h1>
      <p className="mb-4 text-muted-foreground">{t("intro")}</p>
      <TotpForm mode="verify" />
    </>
  );
}
