import { SERVICES, VEHICLE_TYPES } from "@/lib/validation/booking";
import { WEBHOOK_EVENTS } from "./webhooks";

const STATUSES = ["RECEIVED", "CONFIRMED", "DRIVER_EN_ROUTE", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "COMPLETED", "CANCELLED"];

const location = {
  type: "object",
  required: ["address"],
  properties: {
    address: { type: "string", minLength: 3, maxLength: 300, example: "Rruga Mbretëresha Teutë 12, Pejë" },
    lat: { type: ["number", "null"], example: 42.6593, description: "Send coordinates when you have them: the price needs them for domestic jobs." },
    lng: { type: ["number", "null"], example: 20.2887 },
    country: { type: "string", minLength: 2, maxLength: 2, default: "XK", description: "ISO 3166-1 alpha-2" },
    city: { type: ["string", "null"], description: "Used to find fixed international route prices." },
  },
};

const job = {
  service: { type: "string", enum: [...SERVICES] },
  vehicleType: { type: "string", enum: [...VEHICLE_TYPES], default: "CAR" },
  isDrivable: { type: "boolean", default: true },
  pickup: location,
  dropoff: { ...location, type: ["object", "null"], description: "Required except for ROADSIDE_ASSISTANCE." },
  isAsap: { type: "boolean", default: false },
  pickupAt: { type: ["string", "null"], format: "date-time", description: "Required unless isAsap. With windowEnd it is the start of a pickup window." },
  windowEnd: { type: ["string", "null"], format: "date-time" },
  options: {
    type: "object",
    properties: Object.fromEntries(["enclosed", "express", "winch", "highway", "customs", "exportPlates"].map((k) => [k, { type: "boolean", default: false }])),
  },
};

const error = {
  type: "object",
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string", enum: ["unauthorized", "rate_limited", "invalid", "not_found", "too_large"] },
        message: { type: "string" },
        issues: { type: "array", items: { type: "object", properties: { path: { type: "string" }, message: { type: "string" } } } },
      },
    },
  },
};

const order = {
  type: "object",
  properties: {
    number: { type: "string", example: "P-2026-00123" },
    reference: { type: ["string", "null"], description: "Your own reference, as sent." },
    status: { type: "string", enum: STATUSES },
    service: { type: "string", enum: [...SERVICES] },
    priority: { type: "string", enum: ["NORMAL", "URGENT"] },
    pickup: location,
    dropoff: { ...location, type: ["object", "null"] },
    asap: { type: "boolean" },
    requestedAt: { type: ["string", "null"], format: "date-time" },
    plannedAt: { type: ["string", "null"], format: "date-time", description: "When the office planned the pickup." },
    vehicle: { type: ["object", "null"], properties: { type: { type: "string" }, make: { type: "string" }, model: { type: "string" }, plate: { type: ["string", "null"] }, vin: { type: ["string", "null"] } } },
    price: { type: "object", properties: { currency: { type: "string", example: "EUR" }, estimateCents: { type: ["integer", "null"] }, finalCents: { type: ["integer", "null"], description: "Set when the office confirms the order. Gross, VAT included." } } },
    distanceKm: { type: ["number", "null"] },
    driver: { type: ["object", "null"], properties: { firstName: { type: "string" }, truckPlate: { type: "string" } } },
    inspections: { type: "array", items: { type: "object", properties: { kind: { type: "string", enum: ["PICKUP", "DELIVERY"] }, photos: { type: "integer" }, odometerKm: { type: ["integer", "null"] }, signedAt: { type: ["string", "null"], format: "date-time" }, signedBy: { type: ["string", "null"] } } } },
    invoices: { type: "array", items: { type: "object", properties: { number: { type: "string" }, kind: { type: "string" }, status: { type: "string" }, totalCents: { type: "integer" }, paidCents: { type: "integer" } } } },
    events: { type: "array", items: { type: "object", properties: { status: { type: "string", enum: STATUSES }, at: { type: "string", format: "date-time" } } } },
    trackingUrl: { type: "string", format: "uri", description: "Private tracking page to pass on to the person waiting for the car." },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    confirmedAt: { type: ["string", "null"], format: "date-time" },
    deliveredAt: { type: ["string", "null"], format: "date-time" },
    cancelledAt: { type: ["string", "null"], format: "date-time" },
  },
};

const errors = (...codes: number[]) =>
  Object.fromEntries(codes.map((c) => [String(c), { description: { 400: "Bad parameter", 401: "Missing or invalid API key", 404: "Not found", 413: "Body too large", 422: "Invalid fields", 429: "Rate limited" }[c], content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }]));

/** OpenAPI 3.1 description of the partner API, served at /api/v1/openapi.json. */
export function openApiSpec(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "autobartje partner API",
      version: "1.0.0",
      description: "Book and follow towing and car transport jobs from your own system. Prices use your contract. Amounts are euro cents, VAT included unless named net.",
    },
    servers: [{ url: `${baseUrl}/api/v1` }],
    security: [{ apiKey: [] }],
    components: {
      securitySchemes: { apiKey: { type: "http", scheme: "bearer", description: "Your key from the office: Authorization: Bearer abk_…" } },
      schemas: {
        Error: error,
        Order: order,
        Job: { type: "object", required: ["service", "pickup"], properties: job, additionalProperties: false },
        NewOrder: {
          type: "object",
          required: ["service", "pickup", "vehicle", "contact"],
          additionalProperties: false,
          properties: {
            ...job,
            vehicle: { type: "object", required: ["make", "model"], properties: { make: { type: "string" }, model: { type: "string" }, plate: { type: ["string", "null"] }, vin: { type: ["string", "null"], pattern: "^[A-HJ-NPR-Z0-9]{17}$" } } },
            reference: { type: ["string", "null"], maxLength: 60, description: "Your reference, shown on the invoice." },
            contact: { type: "object", required: ["name", "phone"], description: "The person at the pickup.", properties: { name: { type: "string" }, phone: { type: "string", example: "+38344123456" } } },
            notes: { type: ["string", "null"], maxLength: 2000 },
          },
        },
        Quote: {
          type: "object",
          properties: {
            available: { type: "boolean", description: "False when no price can be given automatically; the office will price it." },
            reason: { type: ["string", "null"], enum: ["no_coordinates", "no_route_tariff", "no_base_rule", null] },
            currency: { type: "string" },
            netCents: { type: ["integer", "null"] },
            vatCents: { type: ["integer", "null"] },
            totalCents: { type: ["integer", "null"] },
            lines: { type: "array", items: { type: "object", properties: { label: { type: "string" }, cents: { type: "integer" } } } },
            distanceKm: { type: ["number", "null"] },
            durationMin: { type: ["integer", "null"] },
          },
        },
        WebhookEvent: {
          type: "object",
          description: "POSTed to your webhook URL. Verify X-Autobartje-Signature before trusting it.",
          properties: {
            id: { type: "string", description: "Unique per event; use it to ignore repeats." },
            event: { type: "string", enum: [...WEBHOOK_EVENTS, "ping"] },
            occurredAt: { type: "string", format: "date-time" },
            data: { type: "object", properties: { number: { type: "string" }, status: { type: "string", enum: STATUSES }, previousStatus: { type: "string", enum: STATUSES }, reference: { type: ["string", "null"] } } },
          },
        },
      },
    },
    paths: {
      "/quotes": {
        post: {
          summary: "Price a job",
          description: "Returns the price with your contract. Nothing is booked.",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Job" } } } },
          responses: { 200: { description: "Price", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Quote" } } } } } }, ...errors(401, 413, 422, 429) },
        },
      },
      "/orders": {
        get: {
          summary: "List your orders",
          description: "Newest first. To sync, poll with updated_since or use webhooks.",
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ["open", "done", "all"], default: "all" } },
            { name: "updated_since", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "reference", in: "query", schema: { type: "string" }, description: "Only orders with this reference of yours." },
            { name: "cursor", in: "query", schema: { type: "string" }, description: "nextCursor from the previous page." },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
          ],
          responses: {
            200: { description: "A page of orders", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Order" } }, nextCursor: { type: ["string", "null"] } } } } } },
            ...errors(400, 401, 429),
          },
        },
        post: {
          summary: "Book a job",
          description: "Creates an order with status RECEIVED; the office confirms it with a final price. Send an Idempotency-Key so a retried request does not book twice.",
          parameters: [{ name: "Idempotency-Key", in: "header", schema: { type: "string", pattern: "^[\\w.:-]{8,100}$" } }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/NewOrder" } } } },
          responses: {
            201: { description: "Booked", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Order" } } } } } },
            200: { description: "Same Idempotency-Key as an earlier request: that order is returned" },
            ...errors(400, 401, 413, 422, 429),
          },
        },
      },
      "/orders/{number}": {
        get: {
          summary: "One order",
          parameters: [{ name: "number", in: "path", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "The order", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Order" } } } } } }, ...errors(401, 404, 429) },
        },
      },
    },
    webhooks: {
      orderEvent: {
        post: {
          summary: "Order created or status changed",
          requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/WebhookEvent" } } } },
          responses: { 200: { description: "Answer any 2xx within 10 seconds. Anything else is retried after 1, 5, 15, 60, 360 and 1440 minutes." } },
        },
      },
    },
  };
}
