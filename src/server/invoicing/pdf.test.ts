import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { pdfSafe, renderInvoicePdf, type InvoiceDoc } from "./pdf";
import { calculateInvoice } from "./calc";

const totals = calculateInvoice([
  { description: "Tërheqje automjeti Pejë → Prishtinë, 85 km", quantity: 1, unitPriceCents: 8500 },
  { description: "Shtesë natë", quantity: 1, unitPriceCents: 2125 },
]);
const doc: InvoiceDoc = {
  kind: "INVOICE",
  number: "AB-2026-00001",
  issueDate: new Date("2026-11-02T10:00:00Z"),
  dueDate: new Date("2026-11-17T10:00:00Z"),
  seller: { name: "autobartje", legalName: "autobartje SH.P.K.", nui: "811234567", address: "Rr. Mbretëresha Teuta", city: "Pejë", iban: "XK051212012345678906", bank: "Banka", phone: "+383 44 000 000", email: "info@example.com" },
  buyer: { name: "Dragan Đorđević", nui: null, city: "Mitrovicë", phone: "+38344111222" },
  orderNumber: "P-2026-00042",
  lines: totals.lines,
  subtotalCents: totals.subtotalCents,
  vatCents: totals.vatCents,
  totalCents: totals.totalCents,
  paidCents: 0,
  brandColor: "#0b2545",
  timeZone: "Europe/Belgrade",
};

describe("renderInvoicePdf", () => {
  it("produces a one-page A4 PDF titled with the invoice number", async () => {
    const bytes = await renderInvoicePdf(doc);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBe(1);
    expect(parsed.getTitle()).toBe("Invoice AB-2026-00001");
  });

  it("adds pages for long invoices", async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ description: `Transport ${i + 1}`, quantity: 1, unitPriceCents: 1000 }));
    const t = calculateInvoice(many);
    const bytes = await renderInvoicePdf({ ...doc, lines: t.lines, subtotalCents: t.subtotalCents, vatCents: t.vatCents, totalCents: t.totalCents });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });
});

describe("pdfSafe", () => {
  it("keeps Albanian and German letters and spells the rest plainly", () => {
    expect(pdfSafe("Tërheqje, çmimi, Größe, 59 €")).toBe("Tërheqje, çmimi, Größe, 59 €");
    expect(pdfSafe("Đorđević → Peć")).toBe("Djordjevic -> Pec");
  });
});
