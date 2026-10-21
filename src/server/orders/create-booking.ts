import "server-only";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { priceQuote } from "@/server/pricing/quote";
import { enqueueNotification } from "@/server/notifications/enqueue";
import type { BookingInput } from "@/lib/validation/booking";
import { trackUrl } from "@/lib/tracking";
import { nextOrderNumber } from "./numbering";

export const PRIVACY_POLICY_VERSION = "privacy-2026-10";
export const TERMS_VERSION = "terms-2026-10";

export interface BookingResult {
  orderNumber: string;
  estimatedCents: number | null;
  trackingToken: string;
}

/**
 * Turns a submitted booking into an order. The price is recalculated on the
 * server (the browser's number is never trusted), and everything (customer,
 * vehicle, order, consents, notifications) is written in one transaction.
 */
export async function createBooking(input: BookingInput, meta: { ip: string | null; userAgent: string | null }): Promise<BookingResult> {
  const settings = await getSettings();
  const price = await priceQuote(input.quote, { save: false });
  const q = input.quote;
  const urgent = q.isAsap && (q.service === "EMERGENCY_TOWING" || q.service === "ROADSIDE_ASSISTANCE");

  const order = await db.$transaction(async (tx) => {
    const existing = await tx.customer.findFirst({ where: { phone: input.contact.phone, anonymizedAt: null }, orderBy: { createdAt: "desc" } });
    const customer = existing
      ? await tx.customer.update({
          where: { id: existing.id },
          data: {
            fullName: input.contact.fullName,
            email: input.contact.email ?? existing.email,
            preferredChannel: input.contact.preferredChannel,
            locale: input.locale,
          },
        })
      : await tx.customer.create({
          data: {
            fullName: input.contact.fullName,
            phone: input.contact.phone,
            email: input.contact.email ?? null,
            preferredChannel: input.contact.preferredChannel,
            locale: input.locale,
          },
        });

    const vehicle = await tx.vehicle.create({
      data: {
        customerId: customer.id,
        type: q.vehicleType,
        make: input.vehicle.make,
        model: input.vehicle.model,
        year: input.vehicle.year ?? null,
        plate: input.vehicle.plate?.toUpperCase() || null,
        vin: input.vehicle.vin ?? null,
        isDrivable: q.isDrivable,
        condition: input.vehicle.condition ?? null,
      },
    });

    const number = await nextOrderNumber(tx);
    const created = await tx.order.create({
      data: {
        number,
        status: "RECEIVED",
        priority: urgent ? "URGENT" : "NORMAL",
        service: q.service,
        channel: input.quoteId ? "WEB_QUOTE" : "WEB_BOOKING",
        leadSource: input.leadSource ?? null,
        locale: input.locale,
        customerId: customer.id,
        vehicleId: vehicle.id,
        pickupAddress: q.pickup.address,
        pickupLat: q.pickup.lat ?? null,
        pickupLng: q.pickup.lng ?? null,
        pickupCountry: q.pickup.country,
        dropoffAddress: q.dropoff?.address ?? null,
        dropoffLat: q.dropoff?.lat ?? null,
        dropoffLng: q.dropoff?.lng ?? null,
        dropoffCountry: q.dropoff?.country ?? null,
        distanceKm: price.distanceKm,
        durationMin: price.durationMin,
        isAsap: q.isAsap,
        requestedAt: q.isAsap ? null : (q.pickupAt ?? null),
        windowStart: q.windowStart ?? null,
        windowEnd: q.windowEnd ?? null,
        options: { ...q.options, isDrivable: q.isDrivable, notes: input.notes ?? null },
        estimatedCents: price.available ? price.totalCents : null,
        statusEvents: { create: { to: "RECEIVED", note: "Booking submitted online" } },
      },
    });

    if (input.vehicle.photoKeys.length) {
      const purgeAfter = new Date(Date.now() + settings["retention.inspectionPhotosDays"] * 864e5);
      await tx.document.createMany({
        data: input.vehicle.photoKeys.map((key, i) => ({
          orderId: created.id,
          type: "VEHICLE_PHOTO" as const,
          objectKey: key,
          fileName: `vehicle-${i + 1}.${key.split(".").pop()}`,
          mimeType: key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : key.endsWith(".heic") ? "image/heic" : "image/jpeg",
          sizeBytes: 0,
          purgeAfter,
        })),
      });
    }

    const consent = (type: "TERMS" | "PRIVACY" | "MARKETING", granted: boolean, policyVersion: string) => ({
      customerId: customer.id,
      type,
      granted,
      policyVersion,
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
    });
    await tx.consent.createMany({
      data: [
        consent("TERMS", true, TERMS_VERSION),
        consent("PRIVACY", true, PRIVACY_POLICY_VERSION),
        consent("MARKETING", input.consents.marketing, PRIVACY_POLICY_VERSION),
      ],
    });

    if (input.quoteId) {
      await tx.quote.updateMany({ where: { id: input.quoteId, orderId: null }, data: { orderId: created.id, convertedAt: new Date(), status: "ACCEPTED" } });
    }
    if (q.discountCode) {
      await tx.discountCode.updateMany({ where: { code: q.discountCode }, data: { usedCount: { increment: 1 } } });
    }

    const payload = {
      orderNumber: number,
      customerName: customer.fullName,
      service: q.service,
      pickup: q.pickup.address,
      dropoff: q.dropoff?.address ?? null,
      estimatedCents: created.estimatedCents,
      locale: input.locale,
      trackUrl: trackUrl(created.trackingToken, input.locale),
    };
    const channel = input.contact.preferredChannel;
    const to = channel === "EMAIL" && customer.email ? customer.email : customer.phone;
    await enqueueNotification(tx, { event: "booking_received", channel: channel === "EMAIL" && !customer.email ? "SMS" : channel, to, payload, orderId: created.id });
    if (channel !== "EMAIL" && customer.email) {
      await enqueueNotification(tx, { event: "booking_received", channel: "EMAIL", to: customer.email, payload, orderId: created.id });
    }

    const alertPhone = process.env.DISPATCH_ALERT_PHONE;
    if (alertPhone) {
      await enqueueNotification(tx, { event: "admin_new_order", channel: "SMS", to: alertPhone, payload: { ...payload, urgent, phone: customer.phone }, orderId: created.id });
    }

    await tx.auditLog.create({
      data: { action: "order.created", entityType: "Order", entityId: created.id, after: { number, channel: created.channel, priority: created.priority }, ip: meta.ip },
    });

    return created;
  });

  return { orderNumber: order.number, estimatedCents: order.estimatedCents, trackingToken: order.trackingToken };
}
