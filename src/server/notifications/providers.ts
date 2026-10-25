import "server-only";

/**
 * Delivery providers. Without credentials, messages are printed to the server
 * log (development and preview); in production a missing provider is an error,
 * so the outbox row shows why nothing was sent.
 */
export class ProviderNotConfigured extends Error {}

const isProd = () => process.env.NODE_ENV === "production" && process.env.NOTIFY_DRY_RUN !== "1";

export async function sendEmail(m: { to: string; subject: string; html: string; text: string; attachments?: { filename: string; content: Uint8Array }[] }): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (isProd()) throw new ProviderNotConfigured("RESEND_API_KEY is not set");
    console.info(`[email:console] to=${m.to} subject=${JSON.stringify(m.subject)}${m.attachments?.length ? ` attachments=${m.attachments.map((a) => a.filename).join(",")}` : ""}\n${m.text}`);
    return "console";
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "no-reply@example.com",
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
      attachments: m.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message ?? "error"}`);
  return body.id ?? "";
}

export async function sendSms(m: { to: string; text: string }): Promise<string> {
  if ((process.env.SMS_PROVIDER ?? "console") !== "infobip") {
    if (isProd()) throw new ProviderNotConfigured("SMS_PROVIDER is not set to infobip");
    console.info(`[sms:console] to=${m.to}\n${m.text}`);
    return "console";
  }
  const base = process.env.INFOBIP_BASE_URL?.replace(/\/$/, "");
  const key = process.env.INFOBIP_API_KEY;
  if (!base || !key) throw new ProviderNotConfigured("INFOBIP_BASE_URL / INFOBIP_API_KEY missing");
  const res = await fetch(`${base.startsWith("http") ? base : `https://${base}`}/sms/2/text/advanced`, {
    method: "POST",
    headers: { Authorization: `App ${key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ messages: [{ destinations: [{ to: m.to.replace(/^\+/, "") }], from: process.env.INFOBIP_SENDER ?? "autobartje", text: m.text }] }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { messages?: { messageId?: string; status?: { groupName?: string; description?: string } }[]; requestError?: unknown };
  const msg = body.messages?.[0];
  if (!res.ok || !msg || msg.status?.groupName === "REJECTED") throw new Error(`Infobip ${res.status}: ${msg?.status?.description ?? JSON.stringify(body.requestError ?? body)}`);
  return msg.messageId ?? "";
}
