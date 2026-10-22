import { createHash, createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";

/**
 * Pure helpers for the partner API: key format, webhook signatures and the
 * address checks that keep webhooks from reaching our own network.
 */

const KEY_RE = /^abk_([a-f0-9]{12})_([A-Za-z0-9_-]{43})$/;

/** A new key: "abk_<12 hex>_<43 chars>". The middle part is the public prefix used to look it up. */
export function newApiKey(): { key: string; prefix: string; hash: string } {
  const prefix = randomBytes(6).toString("hex");
  const key = `abk_${prefix}_${randomBytes(32).toString("base64url")}`;
  return { key, prefix, hash: hashKey(key) };
}

export function parseApiKey(key: string): { prefix: string } | null {
  const m = KEY_RE.exec(key);
  return m ? { prefix: m[1] } : null;
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

/** Header value "t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">", the same scheme Stripe uses. */
export function signatureHeader(secret: string, body: string, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

/** Retry delays after a failed delivery, in minutes. After the last one the delivery is marked failed. */
export const RETRY_MINUTES = [1, 5, 15, 60, 360, 1440];

/** Private, loopback, link-local and other non-public ranges, IPv4 and IPv6. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith("ff");
  }
  return true;
}

/**
 * Whether a webhook URL may be saved: https on a public host name or address,
 * no credentials, default port. `allowPrivate` is for local development and tests.
 */
export function webhookUrlProblem(raw: string, allowPrivate = false): "invalid" | "https" | "private" | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "invalid";
  }
  if (u.username || u.password || raw.length > 500) return "invalid";
  if (allowPrivate) return u.protocol === "https:" || u.protocol === "http:" ? null : "https";
  if (u.protocol !== "https:" || (u.port && u.port !== "443")) return "https";
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local") || (!host.includes(".") && !isIP(host))) return "private";
  if (isIP(host) && isPrivateAddress(host)) return "private";
  return null;
}
