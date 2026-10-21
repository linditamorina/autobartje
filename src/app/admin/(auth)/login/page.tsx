import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/server/auth/config";
import { LoginForm } from "@/components/admin/auth-forms";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/admin");
  const t = await getTranslations("Admin.login");
  return (
    <>
      <h1 className="mb-4 text-2xl font-extrabold">{t("title")}</h1>
      <LoginForm />
    </>
  );
}
