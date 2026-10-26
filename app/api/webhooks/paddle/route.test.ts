import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClaimForCheckout } from "@/lib/claims/service";
import { eligibleAnswers, eligibleInput, testDeps } from "@/lib/claims/fixtures";
import { refundPayload, transactionPayload } from "@/lib/payments/fixtures";

const ctx = testDeps();
vi.mock("@/lib/server/deps", () => ({ serviceDeps: () => ctx.deps }));
const { POST } = await import("./route");

const SECRET = "pdl_ntfset_test";
const ENV = {
  PADDLE_API_KEY: "pdl_sdbx_apikey_test",
  PADDLE_PRICE_ID_EUR: "pri_eur",
  PADDLE_PRICE_ID_GBP: "pri_gbp",
  PADDLE_WEBHOOK_SECRET: SECRET,
  PADDLE_CLIENT_TOKEN: "test_token",
};

function request(body: unknown, signature?: string) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000);
  const h1 = createHmac("sha256", SECRET).update(`${ts}:${raw}`).digest("hex");
  return new Request("https://k.test/api/webhooks/paddle", {
    method: "POST",
    body: raw,
    headers: { "paddle-signature": signature ?? `ts=${ts};h1=${h1}` },
  });
}

const fetchMock = vi.fn();

describe("POST /api/webhooks/paddle", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    fetchMock.mockReset().mockImplementation(async () => Response.json({ data: { id: "ctm_01", email: "alex@example.com" } }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("marks a claim paid on a signed transaction.completed event, idempotently", async () => {
    const claim = await createClaimForCheckout(ctx.store, eligibleAnswers, eligibleInput());
    const payload = transactionPayload({ claimId: claim.id, id: "txn_paid" });

    const first = await POST(request(payload));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, result: "recorded" });
    expect((await ctx.store.getById(claim.id))?.status).toBe("paid");
    expect(String(fetchMock.mock.calls[0]![0])).toBe("https://sandbox-api.paddle.com/customers/ctm_01");
    expect(ctx.sent.at(-1)?.to).toBe("alex@example.com");

    expect(await (await POST(request(payload))).json()).toEqual({ ok: true, result: "duplicate" });
  });

  it("asks Paddle to retry when the customer lookup fails", async () => {
    const claim = await createClaimForCheckout(ctx.store, eligibleAnswers, eligibleInput());
    fetchMock.mockImplementation(async () => Response.json({ error: { code: "not_found", detail: "x" } }, { status: 404 }));
    expect((await POST(request(transactionPayload({ claimId: claim.id, id: "txn_retry" })))).status).toBe(502);
    expect((await ctx.store.getById(claim.id))?.status).toBe("checkout_started");
  });

  it("marks the order refunded on an approved full refund", async () => {
    const claim = await createClaimForCheckout(ctx.store, eligibleAnswers, eligibleInput());
    await POST(request(transactionPayload({ claimId: claim.id, id: "txn_refund" })));
    expect(await (await POST(request(refundPayload({ status: "pending_approval", transactionId: "txn_refund" })))).json()).toMatchObject({ result: "ignored" });
    expect(await (await POST(request(refundPayload({ transactionId: "txn_refund" })))).json()).toEqual({ ok: true, result: "refunded" });
  });

  it("rejects a bad signature without touching the store", async () => {
    const claim = await createClaimForCheckout(ctx.store, eligibleAnswers, eligibleInput());
    const res = await POST(request(transactionPayload({ claimId: claim.id }), `ts=${Math.floor(Date.now() / 1000)};h1=${"00".repeat(32)}`));
    expect(res.status).toBe(401);
    expect((await ctx.store.getById(claim.id))?.status).toBe("checkout_started");
  });

  it("rejects invalid JSON and acknowledges ignored events", async () => {
    expect((await POST(request("{not json"))).status).toBe(400);
    expect(await (await POST(request(transactionPayload({ event: "transaction.created" })))).json()).toMatchObject({ result: "ignored" });
  });

  it("returns 503 when payments aren't configured", async () => {
    vi.stubEnv("PADDLE_WEBHOOK_SECRET", "");
    expect((await POST(request(transactionPayload()))).status).toBe(503);
  });
});
