import { describe, expect, it, vi } from "vitest";
import type { PaymentsConfig } from "@/lib/env";
import { createCheckoutUrl, parseWebhookEvent } from "@/lib/payments/stripe";
import { refundEvent, sessionEvent } from "./fixtures";

const config: PaymentsConfig = {
  secretKey: "sk_test_x",
  priceIds: { EUR: "price_eur", GBP: "price_gbp" },
  webhookSecret: "whsec_x",
  managedPayments: false,
  automaticTax: false,
};

describe("parseWebhookEvent", () => {
  it("parses a paid checkout session", () => {
    expect(parseWebhookEvent(sessionEvent({ claimId: "c1" }))).toEqual({
      type: "order_paid",
      claimId: "c1",
      orderId: "pi_1",
      email: "alex@example.com",
      amountCents: 1900,
      currency: "EUR",
      testMode: true,
    });
    expect(parseWebhookEvent(sessionEvent({ type: "checkout.session.async_payment_succeeded" })).type).toBe("order_paid");
  });

  it("parses a full refund", () => {
    expect(parseWebhookEvent(refundEvent())).toEqual({ type: "order_refunded", orderId: "pi_1" });
  });

  it.each([
    ["other events", sessionEvent({ type: "checkout.session.expired" })],
    ["unpaid sessions (delayed payment methods)", sessionEvent({ paymentStatus: "unpaid" })],
    ["no claim id", sessionEvent({ claimId: null })],
    ["no email", sessionEvent({ email: null })],
    ["partial refunds", refundEvent({ refunded: false })],
    ["garbage", "nope"],
  ])("ignores %s", (_label, event) => {
    expect(parseWebhookEvent(event).type).toBe("ignored");
  });
});

describe("createCheckoutUrl", () => {
  const req = { claimId: "c1", currency: "GBP" as const, successUrl: "https://k.test/pack/t", cancelUrl: "https://k.test/result/r" };

  it("creates a one-off session with the server-side price and claim id", async () => {
    const create = vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_1" });
    expect(await createCheckoutUrl(config, req, { create } as never)).toBe("https://checkout.stripe.com/c/pay/cs_1");
    const params = create.mock.calls[0]![0];
    expect(params).toMatchObject({
      mode: "payment",
      line_items: [{ price: "price_gbp", quantity: 1 }],
      client_reference_id: "c1",
      metadata: { claim_id: "c1" },
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
    });
    expect(params.automatic_tax).toBeUndefined();
  });

  it("enables Managed Payments without passing tax settings", async () => {
    const create = vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/x" });
    await createCheckoutUrl({ ...config, managedPayments: true, automaticTax: true }, req, { create } as never);
    const params = create.mock.calls[0]![0];
    expect(params.managed_payments).toEqual({ enabled: true });
    expect(params.automatic_tax).toBeUndefined();
    expect(params.billing_address_collection).toBeUndefined();
  });

  it("turns on Stripe Tax when configured", async () => {
    const create = vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/x" });
    await createCheckoutUrl({ ...config, automaticTax: true }, req, { create } as never);
    expect(create.mock.calls[0]![0]).toMatchObject({ automatic_tax: { enabled: true }, billing_address_collection: "required" });
  });
});
