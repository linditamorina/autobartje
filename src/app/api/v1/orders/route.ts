import { apiError, apiJson, readJson, withApiKey } from "@/server/partner/http";
import { apiOrderSchema, createApiOrder, listApiOrders, parseBody, toQuoteInput } from "@/server/partner/orders";
import { kickOutbox } from "@/server/notifications/kick";

export const dynamic = "force-dynamic";

/** GET /api/v1/orders?status=open|done|all&updated_since=ISO&reference=…&cursor=…&limit=1-100 */
export async function GET(req: Request) {
  return withApiKey(req, async ({ company }) => {
    const sp = new URL(req.url).searchParams;
    const since = sp.get("updated_since");
    const updatedSince = since ? new Date(since) : null;
    if (updatedSince && Number.isNaN(updatedSince.getTime())) return apiError(400, "invalid", "updated_since must be an ISO 8601 date-time.");
    const limit = sp.get("limit") ? Number(sp.get("limit")) : undefined;
    if (limit != null && (!Number.isInteger(limit) || limit < 1 || limit > 100)) return apiError(400, "invalid", "limit must be between 1 and 100.");
    return apiJson(await listApiOrders(company.id, { status: sp.get("status"), updatedSince, reference: sp.get("reference"), cursor: sp.get("cursor"), limit }));
  });
}

/** POST /api/v1/orders: books a job. Send an Idempotency-Key header to make retries safe. */
export async function POST(req: Request) {
  return withApiKey(req, async ({ company, apiKey }) => {
    const idem = req.headers.get("idempotency-key");
    if (idem != null && !/^[\w.:-]{8,100}$/.test(idem)) return apiError(400, "invalid", "Idempotency-Key must be 8-100 letters, digits or . _ : -");
    const body = await readJson(req);
    if (typeof body === "symbol") return apiError(413, "too_large", "The request body must be under 64 KB.");
    const parsed = parseBody(apiOrderSchema, body);
    if (!parsed.ok) return apiError(422, "invalid", "The order is incomplete or has invalid fields.", { issues: parsed.issues });
    const quote = toQuoteInput(parsed.data);
    if (!quote.ok) return apiError(422, "invalid", "The order is incomplete or has invalid fields.", { issues: quote.issues });
    const res = await createApiOrder(company, apiKey, parsed.data, quote.quote, idem);
    if (!res.replayed) kickOutbox();
    return apiJson({ data: res.order }, res.replayed ? 200 : 201, res.replayed ? { "idempotent-replayed": "true" } : {});
  });
}
