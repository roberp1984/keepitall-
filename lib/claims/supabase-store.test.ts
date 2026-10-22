import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createSupabaseStore } from "@/lib/claims/supabase-store";

type Result = { data?: unknown; error?: { code?: string; message: string } | null };

/** Minimal chainable fake of the supabase-js query builder; records each call. */
function fakeClient(results: Result[]) {
  const calls: { table: string; ops: [string, unknown[]][] }[] = [];
  const client = {
    from(table: string) {
      const call = { table, ops: [] as [string, unknown[]][] };
      calls.push(call);
      const result = results.shift() ?? { data: null, error: null };
      const builder: Record<string, unknown> = {};
      for (const op of ["select", "insert", "update", "upsert", "eq", "single", "maybeSingle"]) {
        builder[op] = (...args: unknown[]) => {
          call.ops.push([op, args]);
          return builder;
        };
      }
      builder.then = (resolve: (r: Result) => unknown) => resolve({ data: result.data ?? null, error: result.error ?? null });
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const row = {
  id: "c1",
  pack_token: "t".repeat(43),
  status: "paid",
  answers: { flightNumber: "BA117" },
  claim_input: {},
  assessment: { passengers: 2 },
  regime: "UK261",
  ruleset_version: "uk-261-retained-2021",
  currency: "GBP",
  total_amount: "1040.00",
  created_at: "2026-10-22T10:00:00Z",
  orders: [
    { email: "old@example.com", status: "refunded", created_at: "2026-10-22T10:01:00Z" },
    { email: "buyer@example.com", status: "paid", created_at: "2026-10-22T10:02:00Z" },
  ],
  claim_details: { details: { claimantName: "Alex" }, pack: { facts: {}, pack: {} } },
};

const config = { url: "https://x.supabase.co", serviceRoleKey: "k" };

describe("createSupabaseStore", () => {
  it("maps rows to records (numeric totals, paid order email, nested details)", async () => {
    const { client, calls } = fakeClient([{ data: row }]);
    const claim = await createSupabaseStore(config, client).getByPackToken(row.pack_token);
    expect(claim).toMatchObject({
      id: "c1",
      status: "paid",
      totalAmount: 1040,
      orderEmail: "buyer@example.com",
      details: { claimantName: "Alex" },
      rulesetVersion: "uk-261-retained-2021",
    });
    expect(calls[0]!.table).toBe("claims");
    expect(calls[0]!.ops).toContainEqual(["eq", ["pack_token", row.pack_token]]);
  });

  it("returns null for a missing claim and throws on database errors", async () => {
    expect(await createSupabaseStore(config, fakeClient([{ data: null }]).client).getById("x")).toBeNull();
    await expect(createSupabaseStore(config, fakeClient([{ error: { message: "boom" } }]).client).getById("x")).rejects.toThrow(/boom/);
  });

  it("treats a unique violation on the order id as a duplicate webhook", async () => {
    const { client, calls } = fakeClient([{ error: { code: "23505", message: "duplicate key" } }]);
    const result = await createSupabaseStore(config, client).recordPaidOrder({
      claimId: "c1",
      providerOrderId: "o1",
      email: "a@b.co",
      amountCents: 1700,
      currency: "GBP",
      testMode: false,
    });
    expect(result).toBe("duplicate");
    expect(calls).toHaveLength(1);
  });

  it("records a new order, then marks only a checkout_started claim as paid", async () => {
    const { client, calls } = fakeClient([{}, {}]);
    const result = await createSupabaseStore(config, client).recordPaidOrder({
      claimId: "c1",
      providerOrderId: "o1",
      email: "a@b.co",
      amountCents: 1700,
      currency: "GBP",
      testMode: false,
    });
    expect(result).toBe("recorded");
    expect(calls.map((c) => c.table)).toEqual(["orders", "claims"]);
    expect(calls[1]!.ops).toContainEqual(["eq", ["status", "checkout_started"]]);
  });

  it("refunds by provider order id", async () => {
    const { client, calls } = fakeClient([{ data: { claim_id: "c1" } }, {}]);
    expect(await createSupabaseStore(config, client).recordRefund("o1")).toBe(true);
    expect(calls[1]!.ops).toContainEqual(["eq", ["id", "c1"]]);
    expect(await createSupabaseStore(config, fakeClient([{ data: null }]).client).recordRefund("o2")).toBe(false);
  });

  it("upserts details and marks the pack ready", async () => {
    const { client, calls } = fakeClient([{}, {}]);
    await createSupabaseStore(config, client).saveDetailsAndPack("c1", {} as never, {} as never);
    expect(calls.map((c) => c.table)).toEqual(["claim_details", "claims"]);
    expect(calls[0]!.ops[0]![0]).toBe("upsert");
  });
});
