import "server-only";
import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify as verifyPassword } from "@node-rs/argon2";
import { z } from "zod";
import { db } from "@/server/db";
import { hmac, safeEqual } from "@/server/security/crypto";

/**
 * Staff authentication. Email + password, then TOTP for accounts that have it
 * (mandatory for roles with requires2fa). Sessions are short-lived JWTs that
 * are re-checked against the database on every request, so deactivating a
 * user or bumping tokenVersion logs them out immediately.
 */

export type MfaState = "ok" | "pending" | "setup";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      permissions: string[];
      mfa: MfaState;
    } & DefaultSession["user"];
  }
}

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const SESSION_HOURS = 10;

class LockedError extends CredentialsSignin {
  code = "locked";
}

const credentials = z.object({ email: z.email().toLowerCase(), password: z.string().min(1).max(200) });

/** Proof that this exact session passed the TOTP check; the client cannot forge it. */
export function mfaProof(userId: string, sessionNonce: string): string {
  return hmac(`mfa:${userId}:${sessionNonce}`);
}

export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: SESSION_HOURS * 3600 },
  pages: { signIn: "/admin/login", error: "/admin/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentials.safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email }, include: { role: true, company: { select: { isActive: true } } } });
        if (!user?.passwordHash || !user.isActive) return null;
        // Business portal logins only while their company is active
        if (user.role.key === "B2B_USER" && !user.company?.isActive) return null;
        if (user.lockedUntil && user.lockedUntil > new Date()) throw new LockedError();

        const ok = await verifyPassword(user.passwordHash, parsed.data.password).catch(() => false);
        if (!ok) {
          const failed = user.failedLogins + 1;
          await db.user.update({
            where: { id: user.id },
            data: { failedLogins: failed >= MAX_FAILED ? 0 : failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
          });
          await db.auditLog.create({ data: { actorId: user.id, action: "auth.login_failed", entityType: "User", entityId: user.id } });
          return null;
        }
        await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
        await db.auditLog.create({ data: { actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id } });
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        const u = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { role: true } });
        token.sub = u.id;
        token.tv = u.tokenVersion;
        token.nonce = crypto.randomUUID();
        token.mfa = u.totpEnabledAt ? "pending" : u.role.requires2fa ? "setup" : "ok";
        return token;
      }
      // The only accepted session update is a server-issued MFA proof.
      if (trigger === "update" && session && typeof session === "object" && "mfaProof" in session) {
        const proof = String((session as { mfaProof: unknown }).mfaProof);
        if (token.sub && typeof token.nonce === "string" && safeEqual(proof, mfaProof(token.sub, token.nonce))) token.mfa = "ok";
      }
      return token;
    },
    async session({ session, token }) {
      const u = token.sub ? await db.user.findUnique({ where: { id: token.sub }, include: { role: true } }) : null;
      if (!u || !u.isActive || u.tokenVersion !== token.tv) {
        // Revoked: return a session without a user; requireStaff() redirects to login.
        return { ...session, user: undefined as never };
      }
      session.user = {
        ...session.user,
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role.key,
        permissions: u.role.permissions,
        // A role that newly requires 2FA forces setup on the next request.
        mfa: (token.mfa === "ok" && u.role.requires2fa && !u.totpEnabledAt ? "setup" : token.mfa) as MfaState,
      };
      return session;
    },
  },
});
