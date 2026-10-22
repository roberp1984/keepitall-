import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseWebhookEvent, verifyWebhookSignature } from "@/lib/payments/lemonsqueezy";
import { orderPayload } from "./fixtures";

const SECRET = "whsec_test";
const sign = (body: string, secret = SECRET) => createHmac("sha256", secret).update(body).digest("hex");

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify(orderPayload());

  it("accepts the correct HMAC", () => {
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
    expect(verifyWebhookSignature(body, sign(body).toUpperCase(), SECRET)).toBe(true);
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["not hex", "zzzz"],
    ["wrong secret", sign(body, "other")],
    ["truncated", sign(body).slice(0, 10)],
    ["tampered body", sign(body + " ")],
  ])("rejects a %s signature", (_label, signature) => {
    expect(verifyWebhookSignature(body, signature, SECRET)).toBe(false);
  });
});

describe("parseWebhookEvent", () => {
  it("parses a paid order", () => {
    expect(parseWebhookEvent(orderPayload())).toEqual({
      type: "order_paid",
      claimId: "claim-1",
      orderId: "12345",
      email: "alex@example.com",
      amountCents: 1700,
      currency: "GBP",
      testMode: true,
    });
  });

  it("parses a refund", () => {
    expect(parseWebhookEvent(orderPayload({ event: "order_refunded" }))).toEqual({ type: "order_refunded", orderId: "12345" });
  });

  it.each([
    ["unpaid orders", orderPayload({ status: "pending" }), /status pending/],
    ["other events", orderPayload({ event: "subscription_created" }), /unhandled event/],
    ["missing claim id", orderPayload({ claimId: null }), /claim_id/],
    ["missing email", orderPayload({ email: "" }), /email/],
    ["garbage", "nope", /malformed/],
    ["null", null, /malformed/],
  ])("ignores %s", (_label, payload, reason) => {
    const event = parseWebhookEvent(payload);
    expect(event.type).toBe("ignored");
    if (event.type === "ignored") expect(event.reason).toMatch(reason);
  });
});
