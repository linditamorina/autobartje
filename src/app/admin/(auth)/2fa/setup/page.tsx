import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/server/auth/config";
import { TotpForm } from "@/components/admin/auth-forms";
import { startTotpSetup } from "../../actions";

export default async function TwoFactorSetupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");
  if (session.user.mfa === "pending") redirect("/admin/2fa");
  // Only users without an active authenticator get here; re-enrolment is done by an owner resetting 2FA.
  if (session.user.mfa === "ok") redirect("/admin");
  const t = await getTranslations("Admin.twofa");
  const { qr, secret } = await startTotpSetup();
  return (
    <>
      <h1 className="mb-2 text-2xl font-extrabold">{t("setupTitle")}</h1>
      <p className="mb-4 text-muted-foreground">{t("setupIntro")}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="QR code" width={240} height={240} className="mx-auto rounded-lg bg-white p-2" />
      <p className="mt-3 text-sm">{t("manualKey")}:</p>
      <p className="mb-4 break-all rounded bg-muted p-2 font-mono text-sm" data-testid="totp-secret">{secret}</p>
      <TotpForm mode="setup" />
    </>
  );
}
