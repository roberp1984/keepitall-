import { describe, expect, it, vi } from "vitest";
import { dueFollowUps, followUpDelayDays, purgeCutoffs, runDailyJobs } from "@/lib/claims/lifecycle";
import { createClaimForCheckout, handleOrderPaid, submitDetails } from "@/lib/claims/service";
import { detailsForm, eligibleAnswers, eligibleInput, testDeps } from "./fixtures";

const NOW = new Date("2026-12-31T08:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

async function readyClaim(packReadyDaysAgo: number) {
  const ctx = testDeps();
  const claim = await createClaimForCheckout(ctx.store, eligibleAnswers, eligibleInput());
  await handleOrderPaid(ctx.deps, { claimId: claim.id, orderId: claim.id, email: "buyer@example.com", amountCents: 1700, currency: "GBP", testMode: true });
  await submitDetails(ctx.deps, claim.packToken, detailsForm);
  ctx.store._set(claim.id, { packReadyAt: daysAgo(packReadyDaysAgo) });
  ctx.sent.length = 0;
  return { ...ctx, claim };
}

describe("follow-up timing", () => {
  it("uses the config and the regime's escalation period", () => {
    expect(followUpDelayDays("reply_check", { regime: "UK261" })).toBe(15);
    expect(followUpDelayDays("escalate", { regime: "UK261" })).toBe(56);
    expect(followUpDelayDays("escalate", { regime: "EU261" })).toBe(30);
  });

  it.each([
    [14, []],
    [15, ["reply_check"]],
    [55, ["reply_check"]],
    [56, ["reply_check", "escalate"]],
  ])("UK261 pack ready %i days ago → due %j", async (days, expected) => {
    const { store, claim } = await readyClaim(days);
    expect(dueFollowUps((await store.getById(claim.id))!, NOW)).toEqual(expected);
  });
});

describe("runDailyJobs", () => {
  it("sends the reply-check email once, to the claimant, with an opt-out link", async () => {
    const { deps, sent, claim, store } = await readyClaim(20);
    expect(await runDailyJobs(deps, NOW)).toMatchObject({ followUpsSent: 1, followUpsFailed: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "alex@example.com", subject: "Has the airline replied about flight BA117?" });
    expect(sent[0]!.text).toContain(`/pack/${claim.packToken}/emails`);
    expect(sent[0]!.text).toContain("This is not legal advice.");
    expect((await store.getById(claim.id))!.followUps.reply_check).toBe(NOW.toISOString());

    await runDailyJobs(deps, NOW);
    expect(sent).toHaveLength(1);
  });

  it("sends only the latest follow-up when several are due", async () => {
    const { deps, sent, store, claim } = await readyClaim(60);
    await runDailyJobs(deps, NOW);
    expect(sent.map((m) => m.subject)).toEqual(["Time to escalate your claim for flight BA117?"]);
    expect(Object.keys((await store.getById(claim.id))!.followUps).sort()).toEqual(["escalate", "reply_check"]);
  });

  it("respects the opt-out", async () => {
    const { deps, sent, store, claim } = await readyClaim(20);
    expect(await store.setFollowUpOptOut(claim.packToken)).toBe(true);
    await runDailyJobs(deps, NOW);
    expect(sent).toHaveLength(0);
    expect(await store.setFollowUpOptOut("x".repeat(43))).toBe(false);
  });

  it("retries a failed email the next day", async () => {
    const ctx = await readyClaim(20);
    const send = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue(undefined);
    const deps = { ...ctx.deps, email: { send } };
    expect(await runDailyJobs(deps, NOW)).toMatchObject({ followUpsSent: 0, followUpsFailed: 1 });
    expect(await runDailyJobs(deps, NOW)).toMatchObject({ followUpsSent: 1 });
  });

  it("applies retention: deletes stale unpaid/refunded claims and expires old packs", async () => {
    const { deps, store, claim } = await readyClaim(800);
    const unpaid = await createClaimForCheckout(store, eligibleAnswers, eligibleInput());
    store._set(unpaid.id, { createdAt: daysAgo(31) });
    const fresh = await createClaimForCheckout(store, eligibleAnswers, eligibleInput());
    store._set(fresh.id, { createdAt: daysAgo(1) });

    const { purge } = await runDailyJobs(deps, NOW);
    expect(purge).toEqual({ unpaidDeleted: 1, refundedDeleted: 0, packsExpired: 1 });
    expect(await store.getById(unpaid.id)).toBeNull();
    expect(await store.getById(fresh.id)).not.toBeNull();
    const expired = (await store.getById(claim.id))!;
    expect(expired.status).toBe("expired");
    expect(expired.details).toBeNull();
    expect(expired.pack).toBeNull();
  });

  it("computes cutoffs from the retention config", () => {
    expect(purgeCutoffs(NOW)).toEqual({ unpaidBefore: daysAgo(30), refundedBefore: daysAgo(30), packDetailsBefore: daysAgo(730) });
  });
});
