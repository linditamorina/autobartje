import { NextResponse } from "next/server";
import { assertPortal, ForbiddenError } from "@/server/auth/guard";
import { db } from "@/server/db";
import { invoiceDoc } from "@/server/invoicing/manage";
import { renderInvoicePdf } from "@/server/invoicing/pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: RouteContext<"/api/portal/invoices/[id]/pdf">) {
  let companyId: string;
  try {
    companyId = (await assertPortal()).company.id;
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw err;
  }
  const { id } = await params;
  // Only the company's own issued invoices
  const inv = await db.invoice.findFirst({ where: { id, companyId, status: { not: "DRAFT" } }, select: { id: true } });
  const doc = inv ? await invoiceDoc(inv.id) : null;
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const bytes = await renderInvoicePdf(doc);
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${doc.number}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
