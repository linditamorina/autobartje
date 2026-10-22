import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { isRecipientError, sendWhatsApp, statusUpdates, templateMessage, templateText, validWebhookSignature, WhatsAppRecipientError } from "./whatsapp";

describe("WhatsApp templates", () => {
  it("cleans variables the way Meta requires", () => {
    expect(templateText("a\nb\t c      d")).toBe("a b c d");
    expect(templateText("   ")).toBe("-");
    expect(templateText("x".repeat(2000)).length).toBe(1000);
  });
  it("builds the order update template in the customer's language", () => {
    const m = templateMessage("+38344123456", "de", "P-2026-00042", "Ihr Fahrer ist unterwegs.");
    expect(m.to).toBe("38344123456");
    expect(m.template.language.code).toBe("de");
    expect(m.template.components[0].parameters.map((p) => p.text)).toEqual(["P-2026-00042", "Ihr Fahrer ist unterwegs."]);
    expect(templateMessage("+1", "sr", "P", "t").template.language.code).toBe("sq");
  });
  it("knows which errors mean 'send an SMS instead'", () => {
    expect(isRecipientError(131026)).toBe(true);
    expect(isRecipientError(131000)).toBe(false);
    expect(isRecipientError(undefined)).toBe(false);
  });
});

describe("WhatsApp webhooks", () => {
  it("checks Meta's signature", () => {
    const body = '{"a":1}';
    const sig = `sha256=${createHmac("sha256", "s3cret").update(body).digest("hex")}`;
    expect(validWebhookSignature(body, sig, "s3cret")).toBe(true);
    expect(validWebhookSignature(body, sig, "other")).toBe(false);
    expect(validWebhookSignature(body, null, "s3cret")).toBe(false);
    expect(validWebhookSignature(`${body} `, sig, "s3cret")).toBe(false);
  });
  it("reads delivery statuses", () => {
    const payload = { entry: [{ changes: [{ value: { statuses: [{ id: "wamid.1", status: "failed", errors: [{ code: 131026, title: "Message undeliverable" }] }, { id: "wamid.2", status: "read" }] } }] }] };
    expect(statusUpdates(payload)).toEqual([
      { id: "wamid.1", status: "failed", errorCode: 131026, errorTitle: "Message undeliverable" },
      { id: "wamid.2", status: "read", errorCode: undefined, errorTitle: undefined },
    ]);
    expect(statusUpdates({})).toEqual([]);
  });
});

describe("sendWhatsApp", () => {
  const reply = (status: number, body: unknown) => vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
  const msg = { to: "+38344123456", locale: "en", orderNumber: "P-1", text: "Hi" };

  it("returns Meta's message id", async () => {
    reply(200, { messages: [{ id: "wamid.X" }] });
    expect(await sendWhatsApp(msg)).toBe("wamid.X");
  });
  it("flags numbers that cannot get WhatsApp, so the caller sends an SMS", async () => {
    reply(400, { error: { code: 131026, message: "Receiver is incapable of receiving this message" } });
    await expect(sendWhatsApp(msg)).rejects.toBeInstanceOf(WhatsAppRecipientError);
  });
  it("treats other failures as retryable", async () => {
    reply(500, { error: { code: 131000, message: "Something went wrong" } });
    const err = await sendWhatsApp(msg).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(WhatsAppRecipientError);
  });
});
