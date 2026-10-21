import "server-only";

/**
 * Verifies a Cloudflare Turnstile token. Without TURNSTILE_SECRET_KEY (local
 * development) every request passes; in production the key must be set.
 */
export async function verifyTurnstile(token: string | null | undefined, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!token) return false;
  // Cloudflare's documented test secrets have fixed answers (1x pass, 2x fail, 3x token
  // already spent); answer them locally so CI and offline runs don't depend on Cloudflare.
  const testSecret = /^([123])x0{31}AA$/.exec(secret);
  if (testSecret) return testSecret[1] === "1";
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
