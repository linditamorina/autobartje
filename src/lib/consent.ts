/** Cookie consent shared by client and server. Stored in a first-party cookie, logged to the Consent table. */

export const CONSENT_COOKIE = "ab_consent";
export const CONSENT_POLICY_VERSION = "cookies-2026-10";

export interface CookieConsent {
  analytics: boolean;
  marketing: boolean;
  version: string;
}

export function serializeConsent(c: CookieConsent): string {
  return `${c.version}|a${c.analytics ? 1 : 0}|m${c.marketing ? 1 : 0}`;
}

export function parseConsent(raw: string | undefined | null): CookieConsent | null {
  if (!raw) return null;
  const [version, a, m] = decodeURIComponent(raw).split("|");
  if (version !== CONSENT_POLICY_VERSION || !a || !m) return null; // policy changed → ask again
  return { version, analytics: a === "a1", marketing: m === "m1" };
}
