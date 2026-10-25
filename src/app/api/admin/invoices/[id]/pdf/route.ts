import { NextResponse } from "next/server";
import { assertStaff, ForbiddenError } from "@/server/auth/guard";
import { invoiceDoc } from "@/server/invoicing/manage";
import { renderInvoicePdf } from "@/server/invoicing/pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: RouteContext<"/api/admin/invoices/[id]/pdf">) {
  try {
    await assertStaff("invoices.read");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw err;
  }
  const { id } = await params;
  const doc = await invoiceDoc(id);
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const bytes = await renderInvoicePdf(doc);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
