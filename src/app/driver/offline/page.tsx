import { getTranslations } from "next-intl/server";

export const dynamic = "force-static";

export default async function Offline() {
  const t = await getTranslations("Driver");
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-extrabold">{t("offlineTitle")}</h1>
        <p className="mt-2">{t("offlineText")}</p>
      </div>
    </main>
  );
}
