import { getBrand, getSettings } from "@/server/settings";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 text-[13px] leading-relaxed"><code>{children}</code></pre>;
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="scroll-mt-4 pt-6 text-xl font-extrabold">{children}</h2>;
}

export default async function DevelopersPage() {
  const [brand, s] = await Promise.all([getBrand(), getSettings()]);
  const api = `${siteUrl()}/api/v1`;
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-10 [&_p]:leading-relaxed">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground">{brand.name}</p>
        <h1 className="text-3xl font-extrabold">Partner API</h1>
        <p>Book towing and car transport jobs from your own system, follow them as they happen, and get told when anything changes. Prices use your contract with {brand.name}.</p>
        <p>
          Machine-readable description: <a className="font-semibold underline" href="/api/v1/openapi.json">OpenAPI 3.1</a>. Questions: <a className="font-semibold underline" href={`mailto:${s["contact.email"]}`}>{s["contact.email"]}</a>.
        </p>
      </header>

      <nav aria-label="Contents" className="rounded-xl border border-border p-4 text-sm">
        <ol className="list-decimal space-y-1 pl-5">
          {[["auth", "Keys"], ["quote", "Price a job"], ["book", "Book a job"], ["follow", "Follow your orders"], ["webhooks", "Webhooks"], ["errors", "Errors and limits"]].map(([id, label]) => (
            <li key={id}><a className="underline" href={`#${id}`}>{label}</a></li>
          ))}
        </ol>
      </nav>

      <H2 id="auth">Keys</H2>
      <p>The {brand.name} office creates a key for your company and gives it to you once. Send it on every request. Keep it on your server; anyone with the key can book jobs on your account. Ask the office to revoke a key that leaked and to give you a new one.</p>
      <Code>{`Authorization: Bearer abk_…`}</Code>
      <p>Base URL: <code className="font-mono text-sm">{api}</code>. Bodies are JSON. Amounts are euro cents with VAT, unless called <em>net</em>. Times are ISO 8601.</p>

      <H2 id="quote">Price a job</H2>
      <p>Nothing is booked. Send coordinates for domestic jobs: the distance comes from them. Services: <code>EMERGENCY_TOWING</code>, <code>ROADSIDE_ASSISTANCE</code>, <code>DOMESTIC_TRANSPORT</code>, <code>INTERNATIONAL_TRANSPORT</code>.</p>
      <Code>{`curl -X POST ${api}/quotes \\
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \\
  -d '{
    "service": "DOMESTIC_TRANSPORT",
    "vehicleType": "CAR",
    "pickup":  { "address": "Rruga Mbretëresha Teutë 12, Pejë", "lat": 42.6593, "lng": 20.2887 },
    "dropoff": { "address": "Prishtinë", "lat": 42.6629, "lng": 21.1655 },
    "pickupAt": "2026-11-03T09:00:00+01:00"
  }'`}</Code>
      <Code>{`{ "data": { "available": true, "currency": "EUR", "netCents": 7627, "vatCents": 1373, "totalCents": 9000,
            "lines": [{ "label": "…", "cents": 9000 }], "distanceKm": 84.2, "durationMin": 70 } }`}</Code>
      <p>When <code>available</code> is false the office prices the job by hand; you can still book it.</p>

      <H2 id="book">Book a job</H2>
      <p>Same fields as a quote, plus the vehicle, the person at the pickup and your reference (it appears on the invoice). The order starts as <code>RECEIVED</code>; the office confirms it with a final price. Send an <code>Idempotency-Key</code> (any unique string, 8–100 characters) so that a retry after a timeout does not book twice: the same key returns the first order with status 200.</p>
      <Code>{`curl -X POST ${api}/orders \\
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \\
  -H "Idempotency-Key: claim-88412-transport" \\
  -d '{
    "service": "DOMESTIC_TRANSPORT",
    "pickup":  { "address": "Rruga Mbretëresha Teutë 12, Pejë", "lat": 42.6593, "lng": 20.2887 },
    "dropoff": { "address": "Prishtinë", "lat": 42.6629, "lng": 21.1655 },
    "pickupAt": "2026-11-03T09:00:00+01:00",
    "vehicle": { "make": "VW", "model": "Golf", "plate": "01-234-AB" },
    "contact": { "name": "Arta Krasniqi", "phone": "+38344123456" },
    "reference": "CLAIM-88412",
    "notes": "Keys at the reception"
  }'`}</Code>
      <p>The answer is the order (201). Optional fields: <code>vehicleType</code> (CAR, SUV, VAN, MOTORCYCLE, LUXURY_LOW), <code>isDrivable</code>, <code>isAsap</code> (instead of <code>pickupAt</code>), <code>windowEnd</code> (makes <code>pickupAt</code> the start of a window) and <code>options</code> (<code>winch</code>, <code>enclosed</code>, <code>express</code>, <code>highway</code>, <code>customs</code>, <code>exportPlates</code>).</p>

      <H2 id="follow">Follow your orders</H2>
      <Code>{`GET ${api}/orders/P-2026-00123
GET ${api}/orders?status=open
GET ${api}/orders?updated_since=2026-11-03T08:00:00Z&limit=100
GET ${api}/orders?reference=CLAIM-88412`}</Code>
      <p>An order has its status and the time of every step, the planned pickup, the driver&apos;s first name and truck, the price, the inspections at pickup and delivery (photo count, odometer, who signed), invoices, and <code>trackingUrl</code>: a private page you can pass on to the person waiting for the car. Lists are newest first, 50 per page; pass <code>nextCursor</code> as <code>cursor</code> for the next page.</p>
      <p>Statuses: <code>RECEIVED</code> → <code>CONFIRMED</code> → <code>DRIVER_EN_ROUTE</code> → <code>PICKED_UP</code> → <code>IN_TRANSIT</code> → <code>DELIVERED</code> → <code>COMPLETED</code> (invoiced and paid), or <code>CANCELLED</code>.</p>

      <H2 id="webhooks">Webhooks</H2>
      <p>Give the office an https URL and we POST to it when one of your orders is created (<code>order.created</code>) or changes status (<code>order.status_changed</code>). The office gives you a signing secret once.</p>
      <Code>{`POST https://your-system.example/autobartje
X-Autobartje-Signature: t=1762160400,v1=5f1c…
X-Autobartje-Delivery: cm9x…

{ "id": "cm9x…", "event": "order.status_changed", "occurredAt": "2026-11-03T09:12:41.120Z",
  "data": { "number": "P-2026-00123", "status": "DRIVER_EN_ROUTE", "previousStatus": "CONFIRMED", "reference": "CLAIM-88412" } }`}</Code>
      <p>Check the signature before you trust the body: HMAC-SHA256 of <code>t</code>, a dot and the raw body, with your secret, compared in constant time. Reject times more than 5 minutes off.</p>
      <Code>{`import { createHmac, timingSafeEqual } from "node:crypto";

function verify(rawBody, header, secret) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return v1?.length === expected.length && timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}`}</Code>
      <p>Answer with any 2xx within 10 seconds, then do your work. Otherwise we retry after 1, 5, 15, 60, 360 and 1440 minutes. Events can arrive more than once or out of order: use <code>id</code> to drop repeats and fetch the order for its current state. After 50 failures in a row the webhook is switched off until the office turns it on again.</p>

      <H2 id="errors">Errors and limits</H2>
      <Code>{`{ "error": { "code": "invalid", "message": "The order is incomplete or has invalid fields.",
             "issues": [{ "path": "dropoff", "message": "required" }] } }`}</Code>
      <ul className="list-disc space-y-1 pl-5">
        <li><code>401 unauthorized</code>: missing, wrong or revoked key</li>
        <li><code>404 not_found</code>: no such order for your company</li>
        <li><code>413 too_large</code>: bodies are limited to 64 KB</li>
        <li><code>422 invalid</code>: see <code>issues</code></li>
        <li><code>429 rate_limited</code>: more than 120 requests a minute per key; wait <code>retryAfterSeconds</code></li>
      </ul>
    </main>
  );
}
