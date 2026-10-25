import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashKey, isPrivateAddress, newApiKey, newWebhookSecret, parseApiKey, signatureHeader, webhookUrlProblem } from "./signing";

describe("API keys", () => {
  it("creates keys that parse back to their prefix and hash consistently", () => {
    const k = newApiKey();
    expect(k.key).toMatch(/^abk_[a-f0-9]{12}_[A-Za-z0-9_-]{43}$/);
    expect(parseApiKey(k.key)).toEqual({ prefix: k.prefix });
    expect(hashKey(k.key)).toBe(k.hash);
    expect(newApiKey().key).not.toBe(k.key);
  });
  it("rejects anything else", () => {
    expect(parseApiKey("abk_123_x")).toBeNull();
    expect(parseApiKey(`Bearer ${newApiKey().key}`)).toBeNull();
  });
});

describe("webhook signatures", () => {
  it("signs t.body with HMAC-SHA256", () => {
    const secret = newWebhookSecret();
    const body = '{"event":"order.created"}';
    const header = signatureHeader(secret, body, 1_760_000_000);
    const expected = createHmac("sha256", secret).update(`1760000000.${body}`).digest("hex");
    expect(header).toBe(`t=1760000000,v1=${expected}`);
  });
});

describe("webhook URL checks", () => {
  it("accepts public https URLs", () => {
    expect(webhookUrlProblem("https://hooks.dealer.example/autobartje")).toBeNull();
    expect(webhookUrlProblem("https://93.184.216.34/hook")).toBeNull();
  });
  it("refuses plain http, odd ports, credentials and private hosts", () => {
    expect(webhookUrlProblem("http://hooks.dealer.example/")).toBe("https");
    expect(webhookUrlProblem("https://hooks.dealer.example:8443/")).toBe("https");
    expect(webhookUrlProblem("https://user:pw@hooks.dealer.example/")).toBe("invalid");
    expect(webhookUrlProblem("https://localhost/")).toBe("private");
    expect(webhookUrlProblem("https://intranet/")).toBe("private");
    expect(webhookUrlProblem("https://10.0.0.5/")).toBe("private");
    expect(webhookUrlProblem("https://[::1]/")).toBe("private");
    expect(webhookUrlProblem("not a url")).toBe("invalid");
  });
  it("allows local http only when asked to (development and tests)", () => {
    expect(webhookUrlProblem("http://127.0.0.1:4555/hook", true)).toBeNull();
  });
  it("knows the private ranges", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "172.32.0.1", "2a00:1450:4001::1", "::ffff:8.8.8.8"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});
