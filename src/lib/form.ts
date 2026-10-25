import { BUSINESS_TZ, fromBusinessLocal } from "./time";

/** Small readers for FormData, so server actions stay short. Empty strings become null. */
export function formReader(form: FormData) {
  const raw = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  return {
    str: (k: string) => raw(k),
    opt: (k: string) => raw(k) || null,
    int: (k: string) => (raw(k) === "" ? null : Number(raw(k))),
    bool: (k: string) => form.get(k) === "on" || form.get(k) === "1",
    /** <input type="date">: valid through the end of that day, Kosovo time. */
    expiry: (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(raw(k)) ? fromBusinessLocal(`${raw(k)}T23:59`) : null),
    /** <input type="datetime-local"> in Kosovo time. */
    local: (k: string) => fromBusinessLocal(raw(k)),
  };
}

/** Value for <input type="date"> from a stored expiry. */
export function dateInputValue(d: Date | null | undefined): string {
  return d ? new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d) : "";
}
