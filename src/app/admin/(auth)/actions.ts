"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { generateSecret, generateURI, verify } from "otplib";
import { z } from "zod";
import { auth, mfaProof, signIn, updateSession } from "@/server/auth/config";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { decrypt, encrypt } from "@/server/security/crypto";
import { rateLimit } from "@/server/security/rate-limit";
import { clientIp } from "@/server/security/request";
import { getSettings } from "@/server/settings";

export type FormState = { error?: string } | undefined;

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const ip = (await clientIp()) ?? "unknown";
  if (!rateLimit(`login:${ip}`, 10, 10 * 60_000).ok) return { error: "locked" };
  try {
    await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirectTo: "/admin" });
  } catch (err) {
    if (err instanceof AuthError) return { error: (err as AuthError & { code?: string }).code === "locked" ? "locked" : "invalid" };
    throw err; // redirect
  }
}

const codeSchema = z.string().trim().regex(/^\d{6}$/);

/** Verifies a TOTP code (±30 s clock drift) and returns its time step, or null. Codes at or before afterTimeStep are rejected (replay). */
async function checkCode(secret: string, token: string, afterTimeStep: number | null): Promise<number | null> {
  const result = await verify({ secret, token, epochTolerance: 30, afterTimeStep: afterTimeStep ?? undefined });
  return result.valid && "timeStep" in result ? (result.timeStep as number) : null;
}

/** Second login step for users who have TOTP enabled. */
export async function verifyTotpAction(_: FormState, form: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");
  if (!rateLimit(`totp:${session.user.id}`, 5, 5 * 60_000).ok) return { error: "rateLimited" };
  const code = codeSchema.safeParse(form.get("code"));
  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!code.success || !user.totpSecret) return { error: "invalid" };

  const step = await checkCode(decrypt(user.totpSecret), code.data, user.totpLastStep);
  if (step == null) {
    await db.auditLog.create({ data: { actorId: user.id, action: "auth.2fa_failed", entityType: "User", entityId: user.id } });
    return { error: "invalid" };
  }
  await db.user.update({ where: { id: user.id }, data: { totpLastStep: step } });
  await grantMfa(user.id);
  redirect("/admin");
}

/**
 * Returns the QR code for 2FA setup. The new secret is stored encrypted on the
 * user but only becomes active (totpEnabledAt) once a code from it is confirmed.
 */
export async function startTotpSetup(): Promise<{ qr: string; secret: string }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");
  if (session.user.mfa !== "setup") redirect("/admin");
  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
  let secret: string;
  if (user.totpSecret && !user.totpEnabledAt) {
    secret = decrypt(user.totpSecret);
  } else {
    secret = generateSecret();
    await db.user.update({ where: { id: user.id }, data: { totpSecret: encrypt(secret), totpEnabledAt: null, totpLastStep: null } });
  }
  const settings = await getSettings();
  const uri = generateURI({ issuer: settings["brand.name"], label: user.email, secret });
  return { qr: await QRCode.toDataURL(uri, { margin: 1, width: 240 }), secret };
}

export async function confirmTotpSetupAction(_: FormState, form: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");
  if (session.user.mfa !== "setup") redirect("/admin");
  if (!rateLimit(`totp:${session.user.id}`, 5, 5 * 60_000).ok) return { error: "rateLimited" };
  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const code = codeSchema.safeParse(form.get("code"));
  if (!user.totpSecret || user.totpEnabledAt || !code.success) return { error: "invalid" };
  const step = await checkCode(decrypt(user.totpSecret), code.data, null);
  if (step == null) return { error: "invalid" };

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date(), totpLastStep: step } });
    await audit(tx, { actorId: user.id, action: "auth.2fa_enabled", entityType: "User", entityId: user.id });
  });
  await grantMfa(user.id);
  redirect("/admin");
}

async function grantMfa(userId: string) {
  // The JWT nonce is only known server-side; read it via a fresh session and sign the proof.
  const { getToken } = await import("next-auth/jwt");
  const { headers } = await import("next/headers");
  const h = await headers();
  // Auth.js picks the __Secure- cookie name by request protocol (HTTPS), not by NODE_ENV.
  const secureCookie = (h.get("cookie") ?? "").includes("__Secure-authjs.session-token");
  const token = await getToken({ req: { headers: h } as never, secret: process.env.AUTH_SECRET!, secureCookie });
  const nonce = typeof token?.nonce === "string" ? token.nonce : "";
  await updateSession({ mfaProof: mfaProof(userId, nonce) } as never);
}
