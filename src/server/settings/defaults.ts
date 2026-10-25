import { z } from "zod";

/**
 * Site-wide settings editable in /admin/settings. Each key is one row in the
 * Setting table; anything missing falls back to the defaults below, so the site
 * works on an empty database.
 */
export const settingsSchema = z.object({
  "brand.name": z.string().min(1).max(60),
  "brand.tagline": z.string().max(120),
  /** R2 object key of an uploaded logo, or null for the built-in logo. */
  "brand.logoKey": z.string().nullable(),
  "brand.primaryColor": z.string().regex(/^#[0-9a-fA-F]{6}$/),
  "company.legalName": z.string(),
  "company.nui": z.string(),
  "company.address": z.string(),
  "company.city": z.string(),
  "company.iban": z.string(),
  "company.bank": z.string(),
  "contact.phone": z.string(),
  "contact.whatsapp": z.string(),
  "contact.email": z.string(),
  "contact.lat": z.number(),
  "contact.lng": z.number(),
  /** Google review link sent to customers after delivery; empty = no review request. */
  "review.url": z.union([z.literal(""), z.url().startsWith("https://")]),
  "vat.rateBp": z.number().int().min(0).max(10_000),
  "invoice.series": z.string().regex(/^[A-Z]{1,5}$/),
  "invoice.paymentTermsDays": z.number().int().min(0).max(120),
  "retention.inspectionPhotosDays": z.number().int().min(30),
  "retention.documentsDays": z.number().int().min(30),
  "retention.draftsDays": z.number().int().min(1),
  "retention.gpsDays": z.number().int().min(1),
  "stats.yearsInBusiness": z.number().int().min(0),
  "stats.vehiclesMoved": z.number().int().min(0),
  "stats.avgArrivalMinutes": z.number().int().min(0),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = {
  "brand.name": "autobartje",
  "brand.tagline": "Tërheqje automjetesh 24/7",
  "brand.logoKey": null,
  "brand.primaryColor": "#0b2545",
  "company.legalName": "autobartje SH.P.K.",
  "company.nui": "",
  "company.address": "",
  "company.city": "",
  "company.iban": "",
  "company.bank": "",
  "contact.phone": "+38344000000",
  "contact.whatsapp": "+38344000000",
  "contact.email": "info@example.com",
  "contact.lat": 42.6593,
  "contact.lng": 20.2887,
  "review.url": "",
  "vat.rateBp": 1800,
  "invoice.series": "AB",
  "invoice.paymentTermsDays": 15,
  "retention.inspectionPhotosDays": 730,
  "retention.documentsDays": 1095,
  "retention.draftsDays": 30,
  "retention.gpsDays": 90,
  "stats.yearsInBusiness": 10,
  "stats.vehiclesMoved": 5000,
  "stats.avgArrivalMinutes": 30,
};

