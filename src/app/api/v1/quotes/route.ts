import { apiError, apiJson, readJson, withApiKey } from "@/server/partner/http";
import { apiQuote, apiQuoteSchema, parseBody, toQuoteInput } from "@/server/partner/orders";

export const dynamic = "force-dynamic";

/** POST /api/v1/quotes: the price of a job with the company's contract prices. Nothing is booked. */
export async function POST(req: Request) {
  return withApiKey(req, async ({ company }) => {
    const body = await readJson(req);
    if (typeof body === "symbol") return apiError(413, "too_large", "The request body must be under 64 KB.");
    const parsed = parseBody(apiQuoteSchema, body);
    if (!parsed.ok) return apiError(422, "invalid", "The job is incomplete or has invalid fields.", { issues: parsed.issues });
    const quote = toQuoteInput(parsed.data);
    if (!quote.ok) return apiError(422, "invalid", "The job is incomplete or has invalid fields.", { issues: quote.issues });
    return apiJson({ data: await apiQuote(company.id, quote.quote) });
  });
}
