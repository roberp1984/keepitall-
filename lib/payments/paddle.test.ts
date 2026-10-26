import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PaymentsConfig } from "@/lib/env";
import { createTransaction, customerEmail, parseWebhookEvent, verifyWebhookSignature } from "@/lib/payments/paddle";
import { refundPayload, transactionPayload } from "./fixtures";

const SECRET = "pdl_ntfset_test";
const NOW = 1_800_000_000;
const sign = (body: string, ts = NOW, secret = SECRET) => `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex")}`;

const config: PaymentsConfig = {
  apiKey: "pdl_sdbx_apikey_x",
  environment: "sandbox",
  priceIds: { EUR: "pri_eur", GBP: "pri_gbp" },
  webhookSecret: SECRET,
  clientToken: "test_x",
};

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify(transactionPayload());

  it("accepts the correct HMAC, including during secret rotation", () => {
    expect(verifyWebhookSignature(body, sign(body), SECRET, NOW)).toBe(true);
    const other = sign(body, NOW, "old").split(";")[1];
    expect(verifyWebhookSignature(body, `${sign(body)};${other}`, SECRET, NOW)).toBe(true);
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["without ts", `h1=${"a".repeat(64)}`],
    ["not hex", `ts=${NOW};h1=zzzz`],
    ["wrong secret", sign(body, NOW, "other")],
    ["tampered body", sign(body + " ")],
    ["too old", sign(body, NOW - 301)],
  ])("rejects a %s signature", (_label, header) => {
    expect(verifyWebhookSignature(body, header, SECRET, NOW)).toBe(false);
  });
});

describe("parseWebhookEvent", () => {
  it("parses a completed transaction", () => {
    expect(parseWebhookEvent(transactionPayload({ claimId: "c1" }))).toEqual({
      type: "order_paid",
      claimId: "c1",
      orderId: "txn_01",
      customerId: "ctm_01",
      amountCents: 1900,
      currency: "EUR",
    });
  });

  it("parses an approved full refund", () => {
    expect(parseWebhookEvent(refundPayload())).toEqual({ type: "order_refunded", orderId: "txn_01" });
    expect(parseWebhookEvent(refundPayload({ event: "adjustment.created" }))).toEqual({ type: "order_refunded", orderId: "txn_01" });
  });

  it.each([
    ["other events", transactionPayload({ event: "transaction.paid" })],
    ["no claim id", transactionPayload({ claimId: null })],
    ["no customer", transactionPayload({ customerId: null })],
    ["pending refunds", refundPayload({ status: "pending_approval" })],
    ["partial refunds", refundPayload({ type: "partial" })],
    ["credits", refundPayload({ action: "credit" })],
    ["garbage", "nope"],
  ])("ignores %s", (_label, payload) => {
    expect(parseWebhookEvent(payload).type).toBe("ignored");
  });
});

describe("Paddle API", () => {
  it("creates a transaction with the server-side price and claim id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ data: { id: "txn_new" } }, { status: 201 }));
    expect(await createTransaction(config, { claimId: "c1", currency: "GBP" }, fetchImpl)).toBe("txn_new");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://sandbox-api.paddle.com/transactions");
    expect(init.headers.Authorization).toBe("Bearer pdl_sdbx_apikey_x");
    expect(JSON.parse(init.body)).toEqual({ items: [{ price_id: "pri_gbp", quantity: 1 }], custom_data: { claim_id: "c1" } });
  });

  it("uses the production API in production", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ data: { email: "a@b.co" } }));
    expect(await customerEmail({ ...config, environment: "production" }, "ctm_1", fetchImpl)).toBe("a@b.co");
    expect(fetchImpl.mock.calls[0]![0]).toBe("https://api.paddle.com/customers/ctm_1");
  });

  it("throws Paddle's error detail but never the key", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ error: { code: "forbidden", detail: "nope" } }, { status: 403 }));
    const err = await createTransaction(config, { claimId: "c1", currency: "EUR" }, fetchImpl).catch((e: Error) => e);
    expect(String(err)).toContain("forbidden: nope");
    expect(String(err)).not.toContain(config.apiKey);
  });
});
