import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClaimForCheckout } from "@/lib/claims/service";
import { eligibleAnswers, eligibleInput, testDeps } from "@/lib/claims/fixtures";
import { refundEvent, sessionEvent } from "@/lib/payments/fixtures";

const ctx = testDeps();
vi.mock("@/lib/server/deps", () => ({ serviceDeps: () => ctx.deps }));
const { POST } = await import("./route");

const SECRET = "whsec_test";
const ENV = {
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_PRICE_ID_EUR: "price_eur",
  STRIPE_PRICE_ID_GBP: "price_gbp",
  STRIPE_WEBHOOK_SECRET: SECRET,
};

const stripe = new Stripe("sk_test_x");

function request(body: unknown, signature?: string) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("https://k.test/api/webhooks/stripe", {
    method: "POST",
    body: raw,
    headers: { "stripe-signature": signature ?? stripe.webhooks.generateTestHeaderString({ payload: raw, secret: SECRET }) },
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("marks a claim paid on a signed checkout.session.completed event, idempotently", async () => {
    const claim = await createClaimForCheckout(ctx.store, eligibleAnswers, eligibleInput());
    const payload = sessionEvent({ claimId: claim.id, paymentIntent: "pi_paid" });

    const first = await POST(request(payload));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, result: "recorded" });
    expect((await ctx.store.getById(claim.id))?.status).toBe("paid");
    expect(ctx.sent.at(-1)?.to).toBe("alex@example.com");

    expect(await (await POST(request(payload))).json()).toEqual({ ok: true, result: "duplicate" });
  });

  it("marks the order refunded on a full refund", async () => {
    const claim = await createClaimForCheckout(ctx.store, eligibleAnswers, eligibleInput());
    await POST(request(sessionEvent({ claimId: claim.id, paymentIntent: "pi_refund" })));
    expect(await (await POST(request(refundEvent({ refunded: false, paymentIntent: "pi_refund" })))).json()).toMatchObject({ result: "ignored" });
    expect(await (await POST(request(refundEvent({ paymentIntent: "pi_refund" })))).json()).toEqual({ ok: true, result: "refunded" });
  });

  it("rejects a bad or missing signature without touching the store", async () => {
    const claim = await createClaimForCheckout(ctx.store, eligibleAnswers, eligibleInput());
    const bad = stripe.webhooks.generateTestHeaderString({ payload: "{}", secret: SECRET });
    expect((await POST(request(sessionEvent({ claimId: claim.id }), bad))).status).toBe(401);
    expect((await POST(new Request("https://k.test/api/webhooks/stripe", { method: "POST", body: "{}" }))).status).toBe(401);
    expect((await ctx.store.getById(claim.id))?.status).toBe("checkout_started");
  });

  it("acknowledges ignored events", async () => {
    expect(await (await POST(request(sessionEvent({ type: "checkout.session.expired" })))).json()).toMatchObject({ result: "ignored" });
  });

  it("returns 503 when payments aren't configured", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect((await POST(request(sessionEvent()))).status).toBe(503);
  });
});
