import { describe, expect, it } from "vitest";
import { emailHtml, renderMessage, toGsm } from "./templates";

const ctx = { brand: "autobartje", phone: "+383 44 000 000", primaryColor: "#0b2545", reviewUrl: "https://g.page/r/abc/review", timeZone: "Europe/Belgrade" };

describe("renderMessage", () => {
  it("speaks the customer's language", () => {
    const p = { orderNumber: "P-2026-00042", finalCents: 5900 };
    expect(renderMessage("booking_confirmed", { ...p, locale: "sq" }, ctx)?.text).toContain("Porosia P-2026-00042 u konfirmua");
    expect(renderMessage("booking_confirmed", { ...p, locale: "en" }, ctx)?.text).toMatch(/Price: €59\.00 incl\. VAT/);
    expect(renderMessage("booking_confirmed", { ...p, locale: "de" }, ctx)?.text).toMatch(/Preis: 59,00\s€ inkl\. MwSt\./);
  });

  it("adds the tracking link when there is one", () => {
    const url = "https://example.com/en/track/abc";
    expect(renderMessage("driver_en_route", { orderNumber: "P-1", locale: "en", trackUrl: url }, ctx)?.text).toContain(`Track your order: ${url}`);
    expect(renderMessage("booking_received", { orderNumber: "P-1", locale: "sq" }, ctx)?.text).not.toContain("Ndiqni");
  });

  it("falls back to Albanian for Serbian until it is translated", () => {
    expect(renderMessage("delivered", { orderNumber: "P-1", locale: "sr" }, ctx)?.text).toContain("u dorëzua");
  });

  it("gives the driver the pickup time in Kosovo time", () => {
    const r = renderMessage("driver_assigned", { audience: "driver", orderNumber: "P-1", pickupAddress: "Pejë", start: "2026-11-02T08:30:00Z", truckPlate: "03-123-AB", locale: "en" }, ctx);
    expect(r?.text).toContain("02/11/2026, 09:30");
    expect(r?.text).toContain("03-123-AB");
  });

  it("skips messages that have no audience or no link", () => {
    expect(renderMessage("driver_assigned", { orderNumber: "P-1" }, ctx)).toBeNull();
    expect(renderMessage("review_request", { locale: "en" }, { ...ctx, reviewUrl: "" })).toBeNull();
  });

  it("sends staff alerts in Albanian and flags urgent orders", () => {
    const r = renderMessage("admin_new_order", { orderNumber: "P-9", urgent: true, pickup: "Rr. Pejës", customerName: "Ana", phone: "+38344111222", locale: "de" }, ctx);
    expect(r?.text.startsWith("URGJENT! Porosi e re P-9")).toBe(true);
  });
});

describe("toGsm", () => {
  it("spells Albanian and German without characters that force UCS-2", () => {
    expect(toGsm("Faleminderit që na zgjodhët! Kërkesa → Çmimi 59 €")).toBe("Faleminderit qe na zgjodhet! Kerkesa -> Cmimi 59 EUR");
    expect(toGsm("Größe für Fahrzeug")).toBe("Groesse fuer Fahrzeug");
    expect(toGsm("Abholung: Peć")).toBe("Abholung: Pec");
  });
});

describe("emailHtml", () => {
  it("escapes content and links URLs", () => {
    const html = emailHtml({ subject: "<b>Hi</b>", text: "See https://example.com/x?a=1&b=2" }, ctx);
    expect(html).toContain("&lt;b&gt;Hi&lt;/b&gt;");
    expect(html).toContain('<a href="https://example.com/x?a=1&amp;b=2"');
  });
});
