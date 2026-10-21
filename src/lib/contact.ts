/** Helpers for tel: and wa.me links. Numbers are stored in E.164 (+383...). */

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function whatsappHref(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function mapsLink(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function formatPhone(phone: string): string {
  // +38344123456 → +383 44 123 456
  const m = phone.match(/^\+383(\d{2})(\d{3})(\d{3,4})$/);
  return m ? `+383 ${m[1]} ${m[2]} ${m[3]}` : phone;
}
