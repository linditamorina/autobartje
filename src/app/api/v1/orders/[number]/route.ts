import { apiError, apiJson, withApiKey } from "@/server/partner/http";
import { getApiOrder } from "@/server/partner/orders";

export const dynamic = "force-dynamic";

/** GET /api/v1/orders/{number}: one of the company's orders. */
export async function GET(req: Request, { params }: RouteContext<"/api/v1/orders/[number]">) {
  return withApiKey(req, async ({ company }) => {
    const { number } = await params;
    const order = /^[A-Z0-9-]{3,40}$/i.test(number) ? await getApiOrder(company.id, number.toUpperCase()) : null;
    return order ? apiJson({ data: order }) : apiError(404, "not_found", "No order with this number for your company.");
  });
}
