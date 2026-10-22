import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClaimForCheckout } from "@/lib/claims/service";
import { eligibleAnswers, eligibleInput, testDeps } from "@/lib/claims/fixtures";
import { orderPayload } from "@/lib/payments/fixtures";

const ctx = testDeps();
vi.mock("@/lib/server/deps", () => ({ serviceDeps: () => ctx.deps }));
const { POST } = await import("./route");

const SECRET = "whsec_test";
const ENV = {
  LEMONSQUEEZY_API_KEY: "k",
  LEMONSQUEEZY_STORE_ID: "1",
  LEMONSQUEEZY_VARIANT_ID_EUR: "2",
  LEMONSQUEEZY_VARIANT_ID_GBP: "3",
  LEMONSQUEEZY_WEBHOOK_SECRET: SECRET,
};

function request(body: unknown, signature?: string) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("https://k.test/api/webhooks/lemonsqueezy", {
    method: "POST",
    body: raw,
    headers: { "x-signature": signature ?? createHmac("sha256", SECRET).update(raw).digest("hex") },
  });
}

describe("POST /api/webhooks/lemonsqueezy", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("marks a claim paid on a signed order_created event, idempotently", async () => {
    const claim = await createClaimForCheckout(ctx.store, eligibleAnswers, eligibleInput());
    const payload = orderPayload({ claimId: claim.id });

    const first = await POST(request(payload));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, result: "recorded" });
    expect((await ctx.store.getById(claim.id))?.status).toBe("paid");

    expect(await (await POST(request(payload))).json()).toEqual({ ok: true, result: "duplicate" });
  });

  it("rejects a bad signature without touching the store", async () => {
    const claim = await createClaimForCheckout(ctx.store, eligibleAnswers, eligibleInput());
    const res = await POST(request(orderPayload({ claimId: claim.id }), "00".repeat(32)));
    expect(res.status).toBe(401);
    expect((await ctx.store.getById(claim.id))?.status).toBe("checkout_started");
  });

  it("rejects invalid JSON and acknowledges ignored events", async () => {
    expect((await POST(request("{not json"))).status).toBe(400);
    expect(await (await POST(request(orderPayload({ event: "subscription_created" })))).json()).toMatchObject({ result: "ignored" });
  });

  it("returns 503 when payments aren't configured", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("LEMONSQUEEZY_WEBHOOK_SECRET", "");
    expect((await POST(request(orderPayload()))).status).toBe(503);
  });
});
