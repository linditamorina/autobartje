import { contactSchema, vehicleSchema } from "@/lib/validation/booking";
import { toQuoteInput, type Draft } from "./draft";
import type { DraftErrors } from "./quote-fields";

/**
 * Client-side checks per wizard step. Values are translation keys under
 * Booking.errors; the server validates everything again on submit.
 */
export function validateStep(d: Draft, step: number): DraftErrors {
  const e: DraftErrors = {};
  const intl = d.service === "INTERNATIONAL_TRANSPORT";
  if (step === 1) {
    if (intl) {
      if (!d.fromCity.trim()) e.fromCity = "required";
    } else if (!d.pickup?.address || d.pickup.address.trim().length < 3) e.pickup = "required";
    if (d.service !== "ROADSIDE_ASSISTANCE" && (!d.dropoff?.address || d.dropoff.address.trim().length < 3)) e.dropoff = "required";
  }
  if (step === 2) {
    const r = vehicleSchema.safeParse({ ...d.vehicle, year: d.vehicle.year || null, vin: d.vehicle.vin || null });
    if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] = i.path[0] === "vin" ? "vin" : i.path[0] === "year" ? "year" : "required";
  }
  if (step === 3) {
    const q = toQuoteInput(d);
    if (intl) {
      if (!q.windowStart) e.windowStart = "required";
      if (q.windowStart && q.windowEnd && q.windowEnd < q.windowStart) e.windowEnd = "before_start";
    } else if (!q.isAsap && !q.pickupAt) e.pickupAt = "required";
  }
  if (step === 4) {
    const r = contactSchema.safeParse({ ...d.contact, email: d.contact.email || null });
    if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] = i.path[0] === "phone" ? "phone" : i.path[0] === "email" ? "email" : "required";
  }
  if (step === 5) {
    if (!d.consents.terms) e.terms = "consent";
    if (!d.consents.privacy) e.privacy = "consent";
  }
  return e;
}
