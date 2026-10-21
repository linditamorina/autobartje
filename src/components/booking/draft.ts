import type { BookingInput, QuoteInput } from "@/lib/validation/booking";

export interface Place {
  address: string;
  lat: number | null;
  lng: number | null;
  country: string;
  city: string | null;
}

export interface Draft {
  version: 1;
  step: number;
  quoteId: string | null;
  service: QuoteInput["service"];
  vehicleType: QuoteInput["vehicleType"];
  isDrivable: boolean;
  pickup: Place | null;
  dropoff: Place | null;
  fromCountry: string;
  fromCity: string;
  options: QuoteInput["options"];
  isAsap: boolean;
  /** Local "YYYY-MM-DDTHH:mm" from <input type="datetime-local">. */
  pickupAt: string;
  windowStart: string;
  windowEnd: string;
  discountCode: string;
  vehicle: { make: string; model: string; year: string; plate: string; vin: string; condition: string; photoKeys: string[] };
  contact: { fullName: string; phone: string; email: string; preferredChannel: BookingInput["contact"]["preferredChannel"] };
  notes: string;
  consents: { terms: boolean; privacy: boolean; marketing: boolean };
}

export const DRAFT_KEY = "ab_booking_draft";

export function emptyDraft(): Draft {
  return {
    version: 1,
    step: 1,
    quoteId: null,
    service: "EMERGENCY_TOWING",
    vehicleType: "CAR",
    isDrivable: false,
    pickup: null,
    dropoff: null,
    fromCountry: "DE",
    fromCity: "",
    options: { enclosed: false, express: false, winch: false, highway: false, customs: false, exportPlates: false },
    isAsap: true,
    pickupAt: "",
    windowStart: "",
    windowEnd: "",
    discountCode: "",
    vehicle: { make: "", model: "", year: "", plate: "", vin: "", condition: "", photoKeys: [] },
    contact: { fullName: "", phone: "", email: "", preferredChannel: "PHONE" },
    notes: "",
    consents: { terms: false, privacy: false, marketing: false },
  };
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    // Consents are never restored: they must be given fresh each time.
    return d.version === 1 ? { ...emptyDraft(), ...d, consents: { terms: false, privacy: false, marketing: false } } : null;
  } catch {
    return null;
  }
}

export function saveDraft(d: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, consents: undefined }));
  } catch {}
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

const isIntl = (d: Draft) => d.service === "INTERNATIONAL_TRANSPORT";

/** datetime-local value → Date in the visitor's time zone (they are booking local times). */
function localToDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toQuoteInput(d: Draft): QuoteInput {
  const intl = isIntl(d);
  const pickup = intl
    ? { address: [d.fromCity, d.fromCountry].filter(Boolean).join(", "), lat: null, lng: null, country: d.fromCountry === "OTHER" ? "ZZ" : d.fromCountry, city: d.fromCity || null }
    : (d.pickup ?? { address: "", lat: null, lng: null, country: "XK", city: null });
  return {
    service: d.service,
    vehicleType: d.vehicleType,
    isDrivable: d.isDrivable,
    pickup,
    dropoff: d.service === "ROADSIDE_ASSISTANCE" ? null : d.dropoff,
    options: d.options,
    isAsap: intl ? false : d.isAsap,
    pickupAt: intl ? null : localToDate(d.pickupAt),
    windowStart: intl ? localToDate(d.windowStart) : null,
    windowEnd: intl ? localToDate(d.windowEnd) : null,
    discountCode: d.discountCode || undefined,
  };
}

export function toBookingInput(d: Draft, locale: BookingInput["locale"], turnstileToken: string | null, leadSource: string | null): BookingInput {
  return {
    quote: toQuoteInput(d),
    quoteId: d.quoteId,
    vehicle: {
      make: d.vehicle.make,
      model: d.vehicle.model,
      year: d.vehicle.year ? Number(d.vehicle.year) : null,
      plate: d.vehicle.plate || null,
      vin: d.vehicle.vin || null,
      condition: d.vehicle.condition || null,
      photoKeys: d.vehicle.photoKeys,
    },
    contact: { fullName: d.contact.fullName, phone: d.contact.phone, email: d.contact.email || null, preferredChannel: d.contact.preferredChannel },
    notes: d.notes || null,
    consents: d.consents as BookingInput["consents"],
    locale,
    turnstileToken,
    leadSource,
  };
}
