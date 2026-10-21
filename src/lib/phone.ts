import { parsePhoneNumberFromString } from "libphonenumber-js/min";

/** Normalises a phone number to E.164. Numbers without a country code are read as Kosovo (+383). */
export function normalizePhone(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input.trim(), "XK");
  return parsed?.isValid() ? parsed.number : null;
}
