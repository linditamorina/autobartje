/**
 * Customer, driver and staff messages in sq / en / de (sr falls back to sq
 * until a Serbian translation is added). Pure functions: no I/O, unit tested.
 */
import type { NotificationEvent } from "./events";

export type MsgLocale = "sq" | "en" | "de";
export interface RenderContext {
  brand: string;
  phone: string;
  primaryColor: string;
  reviewUrl: string;
  timeZone: string;
}
export interface Rendered {
  subject: string;
  text: string;
}

type P = Record<string, unknown>;
type Dict = Record<NotificationEvent, (p: P, c: RenderContext, f: Fmt) => Rendered | null>;
type Fmt = { eur: (cents: unknown) => string; time: (iso: unknown) => string };

const s = (v: unknown) => (v == null ? "" : String(v));
/** " <label>: <link>" when the order has a tracking link. */
const track = (p: P, label: string) => (p.trackUrl ? ` ${label}: ${s(p.trackUrl)}` : "");

const sq: Dict = {
  booking_received: (p, c) => ({ subject: `Kërkesa ${s(p.orderNumber)} u pranua`, text: `${c.brand}: E pranuam kërkesën ${s(p.orderNumber)}. Do t'ju telefonojmë së shpejti për konfirmim. Pyetje: ${c.phone}${track(p, "Ndiqni porosinë")}` }),
  booking_confirmed: (p, c, f) => ({ subject: `Porosia ${s(p.orderNumber)} u konfirmua`, text: `${c.brand}: Porosia ${s(p.orderNumber)} u konfirmua.${p.finalCents != null ? ` Çmimi: ${f.eur(p.finalCents)} me TVSH.` : ""} Tel: ${c.phone}${track(p, "Ndiqni porosinë")}` }),
  driver_assigned: (p, c, f) => p.audience === "driver" ? { subject: `Punë e re ${s(p.orderNumber)}`, text: `${c.brand}: Punë e re ${s(p.orderNumber)}. Marrja: ${s(p.pickupAddress)}, ${f.time(p.start)}. Kamioni: ${s(p.truckPlate)}.` } : null,
  driver_en_route: (p, c) => ({ subject: `Shoferi është në rrugë (${s(p.orderNumber)})`, text: `${c.brand}: Shoferi${p.driverName ? ` ${s(p.driverName)}` : ""} është nisur drejt jush${p.truckPlate ? ` (kamioni ${s(p.truckPlate)})` : ""}. Tel: ${c.phone}${track(p, "Ndiqni porosinë")}` }),
  picked_up: (p, c) => ({ subject: `Automjeti u mor (${s(p.orderNumber)})`, text: `${c.brand}: Automjeti juaj u mor në ngarkim. Porosia ${s(p.orderNumber)}.${track(p, "Ndiqni porosinë")}` }),
  delivered: (p, c) => ({ subject: `Automjeti u dorëzua (${s(p.orderNumber)})`, text: `${c.brand}: Automjeti juaj u dorëzua. Faleminderit që na zgjodhët!` }),
  review_request: (_p, c) => c.reviewUrl ? { subject: `Si ishte shërbimi ynë?`, text: `${c.brand}: Faleminderit! Na ndihmon shumë një vlerësim i shkurtër: ${c.reviewUrl}` } : null,
  invoice_issued: (p, c, f) => ({ subject: `Fatura ${s(p.invoiceNumber)}`, text: `${c.brand}: Fatura ${s(p.invoiceNumber)} për ${f.eur(p.totalCents)} është gati.${p.url ? ` ${s(p.url)}` : ""}` }),
  payment_received: (p, c, f) => ({ subject: `Pagesa u pranua`, text: `${c.brand}: E pranuam pagesën prej ${f.eur(p.amountCents)}. Faleminderit!${p.receiptUrl ? ` Dëshmia e pagesës: ${s(p.receiptUrl)}` : ""}` }),
  admin_new_order: (p, _c, f) => ({ subject: `${p.urgent ? "URGJENT " : ""}Porosi e re ${s(p.orderNumber)}`, text: `${p.urgent ? "URGJENT! " : ""}Porosi e re ${s(p.orderNumber)}: ${s(p.pickup)}${p.dropoff ? ` → ${s(p.dropoff)}` : ""}. Klienti: ${s(p.customerName)} ${s(p.phone)}${p.estimatedCents != null ? `. Vlerësim ${f.eur(p.estimatedCents)}` : ""}` }),
  admin_fleet_expiry: (p) => ({ subject: `Dokumente të flotës që skadojnë`, text: `Skadojnë së shpejti:\n${s(p.lines)}` }),
};

const en: Dict = {
  booking_received: (p, c) => ({ subject: `Request ${s(p.orderNumber)} received`, text: `${c.brand}: We received your request ${s(p.orderNumber)}. We will call you shortly to confirm. Questions: ${c.phone}${track(p, "Track your order")}` }),
  booking_confirmed: (p, c, f) => ({ subject: `Order ${s(p.orderNumber)} confirmed`, text: `${c.brand}: Your order ${s(p.orderNumber)} is confirmed.${p.finalCents != null ? ` Price: ${f.eur(p.finalCents)} incl. VAT.` : ""} Phone: ${c.phone}${track(p, "Track your order")}` }),
  driver_assigned: (p, c, f) => p.audience === "driver" ? { subject: `New job ${s(p.orderNumber)}`, text: `${c.brand}: New job ${s(p.orderNumber)}. Pickup: ${s(p.pickupAddress)}, ${f.time(p.start)}. Truck: ${s(p.truckPlate)}.` } : null,
  driver_en_route: (p, c) => ({ subject: `Your driver is on the way (${s(p.orderNumber)})`, text: `${c.brand}: Your driver${p.driverName ? ` ${s(p.driverName)}` : ""} is on the way${p.truckPlate ? ` (truck ${s(p.truckPlate)})` : ""}. Phone: ${c.phone}${track(p, "Track your order")}` }),
  picked_up: (p, c) => ({ subject: `Vehicle picked up (${s(p.orderNumber)})`, text: `${c.brand}: Your vehicle has been loaded. Order ${s(p.orderNumber)}.${track(p, "Track your order")}` }),
  delivered: (p, c) => ({ subject: `Vehicle delivered (${s(p.orderNumber)})`, text: `${c.brand}: Your vehicle has been delivered. Thank you for choosing us!` }),
  review_request: (_p, c) => c.reviewUrl ? { subject: `How did we do?`, text: `${c.brand}: Thank you! A short review helps us a lot: ${c.reviewUrl}` } : null,
  invoice_issued: (p, c, f) => ({ subject: `Invoice ${s(p.invoiceNumber)}`, text: `${c.brand}: Invoice ${s(p.invoiceNumber)} for ${f.eur(p.totalCents)} is ready.${p.url ? ` ${s(p.url)}` : ""}` }),
  payment_received: (p, c, f) => ({ subject: `Payment received`, text: `${c.brand}: We received your payment of ${f.eur(p.amountCents)}. Thank you!${p.receiptUrl ? ` Receipt: ${s(p.receiptUrl)}` : ""}` }),
  admin_new_order: (p, _c, f) => ({ subject: `${p.urgent ? "URGENT " : ""}New order ${s(p.orderNumber)}`, text: `${p.urgent ? "URGENT! " : ""}New order ${s(p.orderNumber)}: ${s(p.pickup)}${p.dropoff ? ` → ${s(p.dropoff)}` : ""}. Customer: ${s(p.customerName)} ${s(p.phone)}${p.estimatedCents != null ? `. Estimate ${f.eur(p.estimatedCents)}` : ""}` }),
  admin_fleet_expiry: (p) => ({ subject: `Fleet documents expiring`, text: `Expiring soon:\n${s(p.lines)}` }),
};

const de: Dict = {
  booking_received: (p, c) => ({ subject: `Anfrage ${s(p.orderNumber)} erhalten`, text: `${c.brand}: Wir haben Ihre Anfrage ${s(p.orderNumber)} erhalten und rufen Sie gleich zur Bestätigung an. Fragen: ${c.phone}${track(p, "Auftrag verfolgen")}` }),
  booking_confirmed: (p, c, f) => ({ subject: `Auftrag ${s(p.orderNumber)} bestätigt`, text: `${c.brand}: Ihr Auftrag ${s(p.orderNumber)} ist bestätigt.${p.finalCents != null ? ` Preis: ${f.eur(p.finalCents)} inkl. MwSt.` : ""} Tel.: ${c.phone}${track(p, "Auftrag verfolgen")}` }),
  driver_assigned: (p, c, f) => p.audience === "driver" ? { subject: `Neuer Auftrag ${s(p.orderNumber)}`, text: `${c.brand}: Neuer Auftrag ${s(p.orderNumber)}. Abholung: ${s(p.pickupAddress)}, ${f.time(p.start)}. Fahrzeug: ${s(p.truckPlate)}.` } : null,
  driver_en_route: (p, c) => ({ subject: `Ihr Fahrer ist unterwegs (${s(p.orderNumber)})`, text: `${c.brand}: Ihr Fahrer${p.driverName ? ` ${s(p.driverName)}` : ""} ist unterwegs${p.truckPlate ? ` (Fahrzeug ${s(p.truckPlate)})` : ""}. Tel.: ${c.phone}${track(p, "Auftrag verfolgen")}` }),
  picked_up: (p, c) => ({ subject: `Fahrzeug abgeholt (${s(p.orderNumber)})`, text: `${c.brand}: Ihr Fahrzeug wurde verladen. Auftrag ${s(p.orderNumber)}.${track(p, "Auftrag verfolgen")}` }),
  delivered: (p, c) => ({ subject: `Fahrzeug zugestellt (${s(p.orderNumber)})`, text: `${c.brand}: Ihr Fahrzeug wurde zugestellt. Vielen Dank!` }),
  review_request: (_p, c) => c.reviewUrl ? { subject: `Wie waren wir?`, text: `${c.brand}: Vielen Dank! Eine kurze Bewertung hilft uns sehr: ${c.reviewUrl}` } : null,
  invoice_issued: (p, c, f) => ({ subject: `Rechnung ${s(p.invoiceNumber)}`, text: `${c.brand}: Rechnung ${s(p.invoiceNumber)} über ${f.eur(p.totalCents)} ist bereit.${p.url ? ` ${s(p.url)}` : ""}` }),
  payment_received: (p, c, f) => ({ subject: `Zahlung erhalten`, text: `${c.brand}: Wir haben Ihre Zahlung über ${f.eur(p.amountCents)} erhalten. Vielen Dank!${p.receiptUrl ? ` Beleg: ${s(p.receiptUrl)}` : ""}` }),
  admin_new_order: (p, _c, f) => ({ subject: `${p.urgent ? "DRINGEND " : ""}Neuer Auftrag ${s(p.orderNumber)}`, text: `${p.urgent ? "DRINGEND! " : ""}Neuer Auftrag ${s(p.orderNumber)}: ${s(p.pickup)}${p.dropoff ? ` → ${s(p.dropoff)}` : ""}. Kunde: ${s(p.customerName)} ${s(p.phone)}${p.estimatedCents != null ? `. Schätzung ${f.eur(p.estimatedCents)}` : ""}` }),
  admin_fleet_expiry: (p) => ({ subject: `Ablaufende Fahrzeugdokumente`, text: `Laufen bald ab:\n${s(p.lines)}` }),
};

const DICTS: Record<MsgLocale, Dict> = { sq, en, de };
const INTL: Record<MsgLocale, string> = { sq: "sq-AL", en: "en-GB", de: "de-DE" };

export function pickLocale(l: unknown): MsgLocale {
  return l === "en" || l === "de" ? l : "sq";
}

/** Returns null when the event has nothing to say for this audience (the outbox row is then SKIPPED). */
export function renderMessage(event: NotificationEvent, payload: P, ctx: RenderContext): Rendered | null {
  // Staff alerts go out in Albanian; customer and driver messages in their own language.
  const locale = event.startsWith("admin_") ? "sq" : pickLocale(payload.locale);
  const fmt: Fmt = {
    eur: (c) => new Intl.NumberFormat(INTL[locale], { style: "currency", currency: "EUR" }).format(Number(c) / 100),
    time: (iso) => (iso ? new Intl.DateTimeFormat(INTL[locale], { timeZone: ctx.timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(String(iso))) : ""),
  };
  return DICTS[locale][event](payload, ctx, fmt);
}

/**
 * SMS in plain GSM-7 fits 160 characters per part instead of 70: Albanian and
 * German letters are spelled without diacritics (ë→e, ç→c, ß→ss, ü→ue ...).
 */
export function toGsm(text: string): string {
  const map: Record<string, string> = { ë: "e", Ë: "E", ç: "c", Ç: "C", ß: "ss", ä: "ae", Ä: "Ae", ö: "oe", Ö: "Oe", ü: "ue", Ü: "Ue", "→": "->", "€": "EUR", "–": "-", "’": "'", " ": " ", " ": " " };
  return text.replace(/[ëËçÇßäÄöÖüÜ→€–’  ]/g, (ch) => map[ch]).normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Minimal, accessible HTML email around the plain text (links made clickable). */
export function emailHtml(r: Rendered, ctx: RenderContext): string {
  const body = esc(r.text)
    .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color:' + ctx.primaryColor + '">$1</a>')
    .replace(/\n/g, "<br>");
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:${ctx.primaryColor};color:#fff;padding:16px 20px;font-size:20px;font-weight:bold">${esc(ctx.brand)}</td></tr>
<tr><td style="padding:20px;font-size:16px;line-height:1.5"><h1 style="font-size:18px;margin:0 0 12px">${esc(r.subject)}</h1>${body}</td></tr>
<tr><td style="padding:12px 20px;font-size:13px;color:#52525b;border-top:1px solid #e4e4e7">${esc(ctx.brand)} · ${esc(ctx.phone)}</td></tr>
</table></td></tr></table></body></html>`;
}
