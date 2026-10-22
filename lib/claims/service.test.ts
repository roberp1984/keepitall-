import { describe, expect, it, vi } from "vitest";
import { toClaimInput } from "@/lib/check/claim-input";
import { createClaimForCheckout, CheckoutNotAllowedError, handleOrderPaid, handleOrderRefunded, submitDetails } from "@/lib/claims/service";
import { generatePackToken, isPackToken } from "@/lib/claims/token";
import { detailsForm, eligibleAnswers, eligibleInput, TODAY, testDeps } from "./fixtures";

const paid = (claimId: string, orderId = "order-1") => ({
  claimId,
  orderId,
  email: "buyer@example.com",
  amountCents: 1700,
  currency: "GBP",
  testMode: true,
});

describe("pack tokens", () => {
  it("are 256-bit, URL-safe and unique", () => {
    const tokens = new Set(Array.from({ length: 200 }, generatePackToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(isPackToken(t)).toBe(true);
    expect(isPackToken("short")).toBe(false);
    expect(isPackToken("../" + "a".repeat(40))).toBe(false);
  });
});

describe("createClaimForCheckout", () => {
  it("stores an eligible claim with its assessment snapshot", async () => {
    const { store } = testDeps();
    const claim = await createClaimForCheckout(store, eligibleAnswers, eligibleInput());
    expect(claim).toMatchObject({ status: "checkout_started", regime: "UK261", currency: "GBP", totalAmount: 1040, rulesetVersion: "uk-261-retained-2021" });
    expect(isPackToken(claim.packToken)).toBe(true);
    expect(claim.assessment.perPassenger?.amount).toBe(520);
  });

  it("refuses ineligible and uncovered flights, whatever the client says", async () => {
    const { store } = testDeps();
    const short = { ...eligibleAnswers, delayMinutes: 60 };
    await expect(createClaimForCheckout(store, short, toClaimInput(short, TODAY)!)).rejects.toThrow(CheckoutNotAllowedError);
    const uncovered = { ...eligibleAnswers, from: "JFK", to: "LHR", carrier: { kind: "region" as const, region: "other" as const } };
    await expect(createClaimForCheckout(store, uncovered, toClaimInput(uncovered, TODAY)!)).rejects.toThrow(CheckoutNotAllowedError);
  });
});

describe("handleOrderPaid", () => {
  it("marks the claim paid and emails the private pack link once", async () => {
    const { deps, store, sent } = testDeps();
    const claim = await createClaimForCheckout(store, eligibleAnswers, eligibleInput());

    expect(await handleOrderPaid(deps, paid(claim.id))).toBe("recorded");
    expect(await handleOrderPaid(deps, paid(claim.id))).toBe("duplicate");

    expect((await store.getById(claim.id))?.status).toBe("paid");
    expect((await store.getById(claim.id))?.orderEmail).toBe("buyer@example.com");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("buyer@example.com");
    expect(sent[0]!.text).toContain(`https://keepitall.test/pack/${claim.packToken}`);
    expect(sent[0]!.text).toContain("This is not legal advice.");
  });

  it("returns unknown_claim for orders we didn't create", async () => {
    const { deps, sent } = testDeps();
    expect(await handleOrderPaid(deps, paid("nope"))).toBe("unknown_claim");
    expect(sent).toHaveLength(0);
  });

  it("still records payment if the email fails", async () => {
    const { deps, store, logs } = testDeps({ email: { send: vi.fn().mockRejectedValue(new Error("smtp down")) } });
    const claim = await createClaimForCheckout(store, eligibleAnswers, eligibleInput());
    expect(await handleOrderPaid(deps, paid(claim.id))).toBe("recorded");
    expect((await store.getById(claim.id))?.status).toBe("paid");
    expect(logs).toContain("payment confirmation email failed");
  });

  it("logs a currency mismatch", async () => {
    const { deps, store, logs } = testDeps();
    const claim = await createClaimForCheckout(store, eligibleAnswers, eligibleInput());
    await handleOrderPaid(deps, { ...paid(claim.id), currency: "EUR" });
    expect(logs).toContain("order currency differs from claim currency");
  });
});

describe("handleOrderRefunded", () => {
  it("marks the claim refunded", async () => {
    const { deps, store } = testDeps();
    const claim = await createClaimForCheckout(store, eligibleAnswers, eligibleInput());
    await handleOrderPaid(deps, paid(claim.id));
    expect(await handleOrderRefunded(deps, "order-1")).toBe(true);
    expect((await store.getById(claim.id))?.status).toBe("refunded");
    expect(await handleOrderRefunded(deps, "unknown")).toBe(false);
  });
});

describe("submitDetails", () => {
  async function paidClaim(overrides = {}) {
    const ctx = testDeps(overrides);
    const claim = await createClaimForCheckout(ctx.store, eligibleAnswers, eligibleInput());
    await handleOrderPaid(ctx.deps, paid(claim.id));
    ctx.sent.length = 0;
    return { ...ctx, claim };
  }

  it("builds, stores and emails the pack with the exact paid-for amounts", async () => {
    const { deps, store, sent, claim } = await paidClaim();
    expect(await submitDetails(deps, claim.packToken, detailsForm)).toEqual({ ok: true });

    const saved = (await store.getByPackToken(claim.packToken))!;
    expect(saved.status).toBe("pack_ready");
    expect(saved.details).toMatchObject({ passengers: ["Alex Morgan", "Sam Morgan"], bookingReference: "ABC123", postalAddress: "1 High Street\nLondon\nSW1A 1AA" });
    const { facts, pack } = saved.pack!;
    expect(facts.total).toEqual({ amount: 1040, currency: "GBP" });
    expect(pack.claimLetter.source).toBe("template");
    expect(pack.claimLetter.text).toContain("For 2 passengers (Alex Morgan and Sam Morgan) the total is £1,040");
    expect(pack.claimLetter.text).toContain("Subject: UK261 compensation claim – flight BA117 on 15 June 2026 – booking ABC123");
    expect(pack.disclaimer).toBe("This is not legal advice. We provide templates and information.");

    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("alex@example.com");
    expect(sent[0]!.attachments?.[0]?.filename).toBe("claim-pack-BA117.pdf");
  });

  it("uses the LLM body when a generator is configured, and never sends it personal data", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("offline"));
    const { deps, claim, store } = await paidClaim({ generate });
    await submitDetails(deps, claim.packToken, detailsForm);
    const prompt = JSON.stringify(generate.mock.calls[0]![0]);
    for (const secret of ["Alex", "Sam", "alex@example.com", "High Street", "ABC123"]) expect(prompt).not.toContain(secret);
    expect((await store.getByPackToken(claim.packToken))!.pack!.pack.claimLetter.source).toBe("template");
  });

  it("rejects unpaid, unknown and already-completed claims", async () => {
    const { deps, store } = testDeps();
    const claim = await createClaimForCheckout(store, eligibleAnswers, eligibleInput());
    expect(await submitDetails(deps, claim.packToken, detailsForm)).toMatchObject({ ok: false, error: "not_paid" });
    expect(await submitDetails(deps, "x".repeat(43), detailsForm)).toMatchObject({ ok: false, error: "not_found" });

    await handleOrderPaid(deps, paid(claim.id));
    await submitDetails(deps, claim.packToken, detailsForm);
    expect(await submitDetails(deps, claim.packToken, detailsForm)).toMatchObject({ ok: false, error: "already_complete" });
  });

  it.each([
    ["missing passenger", { passengers: [] }],
    ["bad booking reference", { bookingReference: "AB" }],
    ["bad email", { email: "nope" }],
    ["empty address", { postalAddress: "  " }],
  ])("rejects %s without saving", async (_label, overrides) => {
    const { deps, claim, store, sent } = await paidClaim();
    const result = await submitDetails(deps, claim.packToken, { ...detailsForm, ...overrides });
    expect(result).toMatchObject({ ok: false, error: "invalid" });
    expect((await store.getByPackToken(claim.packToken))!.status).toBe("paid");
    expect(sent).toHaveLength(0);
  });

  it("saves the pack even if the email or PDF fails", async () => {
    const { deps, claim, store, logs } = await paidClaim({ renderPdf: vi.fn().mockRejectedValue(new Error("pdf boom")) });
    expect(await submitDetails(deps, claim.packToken, detailsForm)).toEqual({ ok: true });
    expect((await store.getByPackToken(claim.packToken))!.status).toBe("pack_ready");
    expect(logs).toContain("pack email failed");
  });
});

describe("analytics", () => {
  it("tracks payment_succeeded server-side once, with no personal data", async () => {
    const track = vi.fn().mockResolvedValue(undefined);
    const { deps, store } = testDeps({ track });
    const claim = await createClaimForCheckout(store, eligibleAnswers, eligibleInput());
    await handleOrderPaid(deps, paid(claim.id));
    await handleOrderPaid(deps, paid(claim.id));
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("payment_succeeded", claim.id, { regime: "UK261", currency: "GBP", test_mode: true });
  });
});
