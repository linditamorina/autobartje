import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const SERVICES = ["EMERGENCY_TOWING", "ROADSIDE_ASSISTANCE", "DOMESTIC_TRANSPORT", "INTERNATIONAL_TRANSPORT"] as const;
export const VEHICLE_TYPES = ["CAR", "SUV", "VAN", "MOTORCYCLE", "LUXURY_LOW"] as const;
export const CHANNELS = ["PHONE", "SMS", "WHATSAPP", "EMAIL"] as const;
export const ORIGIN_COUNTRIES = ["DE", "AT", "CH", "IT", "FR", "BE", "NL", "SE", "OTHER"] as const;

const coord = z.number().finite();

export const locationSchema = z.object({
  address: z.string().trim().min(3).max(300),
  lat: coord.min(-90).max(90).nullable().optional(),
  lng: coord.min(-180).max(180).nullable().optional(),
  country: z.string().trim().length(2).toUpperCase().default("XK"),
  city: z.string().trim().max(100).nullable().optional(),
});
export type LocationInput = z.infer<typeof locationSchema>;

export const optionsSchema = z.object({
  enclosed: z.boolean().default(false),
  express: z.boolean().default(false),
  winch: z.boolean().default(false),
  highway: z.boolean().default(false),
  customs: z.boolean().default(false),
  exportPlates: z.boolean().default(false),
});

export const quoteInputSchema = z
  .object({
    service: z.enum(SERVICES),
    vehicleType: z.enum(VEHICLE_TYPES),
    isDrivable: z.boolean(),
    pickup: locationSchema,
    dropoff: locationSchema.nullable(),
    options: optionsSchema,
    isAsap: z.boolean(),
    pickupAt: z.coerce.date().nullable(),
    windowStart: z.coerce.date().nullable().optional(),
    windowEnd: z.coerce.date().nullable().optional(),
    discountCode: z.string().trim().toUpperCase().max(40).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.service !== "ROADSIDE_ASSISTANCE" && !v.dropoff) {
      ctx.addIssue({ code: "custom", path: ["dropoff"], message: "required" });
    }
    if (!v.isAsap && !v.pickupAt && !v.windowStart) {
      ctx.addIssue({ code: "custom", path: ["pickupAt"], message: "required" });
    }
    if (v.windowStart && v.windowEnd && v.windowEnd < v.windowStart) {
      ctx.addIssue({ code: "custom", path: ["windowEnd"], message: "before_start" });
    }
  });
export type QuoteInput = z.infer<typeof quoteInputSchema>;

const currentYear = new Date().getFullYear();

export const vehicleSchema = z.object({
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  year: z.coerce.number().int().min(1950).max(currentYear + 1).nullable().optional(),
  plate: z.string().trim().max(20).nullable().optional(),
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, "vin")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  condition: z.string().trim().max(500).nullable().optional(),
  /** R2 object keys of photos uploaded through /api/uploads/presign. */
  photoKeys: z.array(z.string().regex(/^uploads\/[\w/-]+\.(jpe?g|png|webp|heic)$/)).max(8).default([]),
});

export const phoneSchema = z
  .string()
  .trim()
  .min(6)
  .max(25)
  .transform((v, ctx) => {
    const e164 = normalizePhone(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "phone" });
      return z.NEVER;
    }
    return e164;
  });

export const contactSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  email: z.email().max(200).nullable().optional().or(z.literal("").transform(() => null)),
  preferredChannel: z.enum(CHANNELS),
});

export const bookingSchema = z.object({
  quote: quoteInputSchema,
  quoteId: z.string().max(40).nullable().optional(),
  vehicle: vehicleSchema,
  contact: contactSchema,
  notes: z.string().trim().max(1000).nullable().optional(),
  consents: z.object({
    terms: z.literal(true),
    privacy: z.literal(true),
    marketing: z.boolean(),
  }),
  locale: z.enum(["sq", "en", "de"]),
  turnstileToken: z.string().max(4096).nullable().optional(),
  leadSource: z.string().max(100).nullable().optional(),
});
export type BookingInput = z.infer<typeof bookingSchema>;
