import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

/** Everything printed on an invoice. Built from the immutable snapshots stored at issue time. */
export interface InvoiceDoc {
  kind: "INVOICE" | "CREDIT_NOTE" | "PROFORMA";
  number: string;
  issueDate: Date;
  dueDate: Date | null;
  seller: { name: string; legalName: string; nui: string; address: string; city: string; iban: string; bank: string; phone: string; email: string };
  buyer: { name: string; nui?: string | null; address?: string | null; city?: string | null; email?: string | null; phone?: string | null };
  orderNumber?: string | null;
  creditedNumber?: string | null;
  lines: { description: string; quantity: number; unit: string; unitPriceCents: number; vatRateBp: number; netCents: number; vatCents: number; grossCents: number }[];
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  paidCents: number;
  /** Unit prices on the lines include VAT. */
  pricesIncludeVat?: boolean;
  brandColor: string;
  timeZone: string;
}

const TITLE = { INVOICE: "FATURË / INVOICE", CREDIT_NOTE: "NOTË KREDITI / CREDIT NOTE", PROFORMA: "PROFATURË / PRO FORMA" };

/** Standard PDF fonts only cover Windows-1252: spell other letters without accents (č→c, đ→dj). */
const WIN_ANSI = /[\x20-\x7e\xa0-\xffŠšŽžŒœŸ€–—‘’“”•…]/;
export function pdfSafe(text: string): string {
  return [...text.replace(/đ/g, "dj").replace(/Đ/g, "Dj").replace(/→/g, "->")]
    .map((ch) => (WIN_ANSI.test(ch) ? ch : ch.normalize("NFKD").replace(/[̀-ͯ]/g, "")))
    .map((ch) => (WIN_ANSI.test(ch) ? ch : "?"))
    .join("");
}

const eur = (c: number) => `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

export async function renderInvoicePdf(doc: InvoiceDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${doc.kind === "CREDIT_NOTE" ? "Credit note" : "Invoice"} ${doc.number}`);
  pdf.setAuthor(pdfSafe(doc.seller.legalName || doc.seller.name));
  pdf.setCreationDate(doc.issueDate);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const brand = /^#[0-9a-f]{6}$/i.test(doc.brandColor) ? hex(doc.brandColor) : rgb(0.04, 0.15, 0.27);
  const grey = rgb(0.35, 0.35, 0.38);
  const date = (d: Date) => new Intl.DateTimeFormat("de-DE", { timeZone: doc.timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

  let page = pdf.addPage([595.28, 841.89]);
  const M = 48;
  const W = 595.28 - 2 * M;
  let y = 841.89 - M;

  const text = (p: PDFPage, s: string, x: number, yy: number, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean } = {}) => {
    const size = o.size ?? 9;
    const font = o.font ?? regular;
    const t = pdfSafe(s);
    p.drawText(t, { x: o.right ? x - font.widthOfTextAtSize(t, size) : x, y: yy, size, font, color: o.color ?? rgb(0.1, 0.1, 0.12) });
  };
  /** Word-wraps to a width; returns the lines. */
  const wrap = (s: string, width: number, size = 9, font = regular) => {
    const words = pdfSafe(s).split(/\s+/);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && cur) {
        out.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  };

  // Header: seller
  text(page, doc.seller.name, M, y, { size: 20, font: bold, color: brand });
  text(page, TITLE[doc.kind], M + W, y, { size: 13, font: bold, right: true });
  y -= 16;
  const sellerLines = [doc.seller.legalName, [doc.seller.address, doc.seller.city].filter(Boolean).join(", "), doc.seller.nui && `NUI: ${doc.seller.nui}`, [doc.seller.phone, doc.seller.email].filter(Boolean).join(" · ")].filter(Boolean) as string[];
  const metaLines: [string, string][] = [
    ["Nr. / No.", doc.number],
    ["Data / Date", date(doc.issueDate)],
    ...(doc.dueDate && doc.kind !== "CREDIT_NOTE" ? [["Afati / Due", date(doc.dueDate)] as [string, string]] : []),
    ...(doc.orderNumber ? [["Porosia / Order", doc.orderNumber] as [string, string]] : []),
    ...(doc.creditedNumber ? [["Për faturën / For invoice", doc.creditedNumber] as [string, string]] : []),
  ];
  const headerTop = y;
  for (const l of sellerLines) {
    text(page, l, M, y, { color: grey });
    y -= 12;
  }
  let my = headerTop;
  for (const [k, v] of metaLines) {
    text(page, k, M + W - 110, my, { color: grey, right: true });
    text(page, v, M + W, my, { font: bold, right: true });
    my -= 12;
  }
  y = Math.min(y, my) - 16;

  // Buyer
  page.drawRectangle({ x: M, y: y - 62, width: W / 2, height: 70, color: rgb(0.96, 0.96, 0.97) });
  text(page, "Blerësi / Bill to", M + 8, y - 6, { color: grey, size: 8 });
  let by = y - 20;
  for (const l of [doc.buyer.name, [doc.buyer.address, doc.buyer.city].filter(Boolean).join(", "), doc.buyer.nui ? `NUI: ${doc.buyer.nui}` : "", [doc.buyer.phone, doc.buyer.email].filter(Boolean).join(" · ")].filter(Boolean)) {
    text(page, l, M + 8, by, { font: by === y - 20 ? bold : regular, size: by === y - 20 ? 10 : 9 });
    by -= 12;
  }
  y -= 90;

  // Lines table
  const cols = { pos: M, desc: M + 18, qty: M + 290, price: M + 360, vat: M + 418, total: M + W };
  const header = () => {
    page.drawRectangle({ x: M, y: y - 4, width: W, height: 18, color: brand });
    const white = rgb(1, 1, 1);
    text(page, "#", cols.pos + 2, y + 1, { font: bold, color: white, size: 8 });
    text(page, "Përshkrimi / Description", cols.desc, y + 1, { font: bold, color: white, size: 8 });
    text(page, "Sasia / Qty", cols.qty, y + 1, { font: bold, color: white, size: 8, right: true });
    text(page, "Çmimi / Price", cols.price, y + 1, { font: bold, color: white, size: 8, right: true });
    text(page, "TVSH / VAT", cols.vat, y + 1, { font: bold, color: white, size: 8, right: true });
    text(page, "Neto / Net", cols.total - 2, y + 1, { font: bold, color: white, size: 8, right: true });
    y -= 20;
  };
  header();
  doc.lines.forEach((l, i) => {
    const desc = wrap(l.description, cols.qty - cols.desc - 50);
    const h = desc.length * 11;
    if (y - h < 160) {
      page = pdf.addPage([595.28, 841.89]);
      y = 841.89 - M;
      header();
    }
    text(page, String(i + 1), cols.pos + 2, y);
    desc.forEach((d, j) => text(page, d, cols.desc, y - j * 11));
    text(page, `${l.quantity.toLocaleString("de-DE")} ${l.unit}`, cols.qty, y, { right: true });
    text(page, eur(l.unitPriceCents), cols.price, y, { right: true });
    text(page, `${l.vatRateBp / 100}%`, cols.vat, y, { right: true });
    text(page, eur(l.netCents), cols.total - 2, y, { right: true });
    y -= h;
    page.drawLine({ start: { x: M, y: y + 5 }, end: { x: M + W, y: y + 5 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.87) });
    y -= 9;
  });

  // Totals
  y -= 6;
  const totalRow = (k: string, v: string, strong = false) => {
    text(page, k, M + W - 120, y, { right: true, font: strong ? bold : regular, size: strong ? 11 : 9 });
    text(page, v, M + W, y, { right: true, font: strong ? bold : regular, size: strong ? 11 : 9 });
    y -= strong ? 16 : 13;
  };
  if (doc.pricesIncludeVat) {
    text(page, "Çmimet përfshijnë TVSH / Unit prices include VAT", M, y, { size: 8, color: grey });
  }
  totalRow("Pa TVSH / Net", eur(doc.subtotalCents));
  const rates = [...new Set(doc.lines.map((l) => l.vatRateBp))];
  for (const r of rates) totalRow(`TVSH / VAT ${r / 100}%`, eur(doc.lines.filter((l) => l.vatRateBp === r).reduce((a, l) => a + l.vatCents, 0)));
  totalRow("Gjithsej / Total EUR", eur(doc.totalCents), true);
  if (doc.paidCents > 0 && doc.kind === "INVOICE") {
    totalRow("Paguar / Paid", eur(doc.paidCents));
    totalRow("Për t'u paguar / Balance due", eur(Math.max(0, doc.totalCents - doc.paidCents)), true);
  }

  // Footer: payment details
  const fy = 72;
  page.drawLine({ start: { x: M, y: fy + 26 }, end: { x: M + W, y: fy + 26 }, thickness: 0.5, color: grey });
  if (doc.seller.iban) text(page, `IBAN: ${doc.seller.iban}${doc.seller.bank ? ` · ${doc.seller.bank}` : ""} · Ref: ${doc.number}`, M, fy + 12, { size: 8, color: grey });
  text(page, `${doc.seller.legalName || doc.seller.name}${doc.seller.nui ? ` · NUI ${doc.seller.nui}` : ""}`, M, fy, { size: 8, color: grey });
  const pages = pdf.getPages();
  pages.forEach((p, i) => text(p, `${i + 1}/${pages.length}`, M + W, 40, { size: 8, color: grey, right: true }));

  return pdf.save();
}
