// Server-only: uses the service-role key.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseConfig } from "../env";
import type { ClaimRecord, ClaimStatus, ClaimStore, DetailsForm, FollowUpId, NewClaim, StoredPack } from "./types";

const UNIQUE_VIOLATION = "23505";
const SELECT = "*, orders(email, status, created_at), claim_details(details, pack)";

type Row = Record<string, unknown>;

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toRecord(row: Row): ClaimRecord {
  const orders = (Array.isArray(row.orders) ? row.orders : row.orders ? [row.orders] : []) as Row[];
  const paid = orders.filter((o) => o.status === "paid").sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const details = one(row.claim_details as Row | Row[] | null);
  return {
    id: String(row.id),
    packToken: String(row.pack_token),
    status: row.status as ClaimStatus,
    answers: row.answers as ClaimRecord["answers"],
    input: row.claim_input as ClaimRecord["input"],
    assessment: row.assessment as ClaimRecord["assessment"],
    regime: row.regime as ClaimRecord["regime"],
    rulesetVersion: String(row.ruleset_version),
    currency: row.currency as ClaimRecord["currency"],
    totalAmount: Number(row.total_amount),
    orderEmail: paid[0] ? String(paid[0].email) : null,
    details: (details?.details as DetailsForm | undefined) ?? null,
    pack: (details?.pack as StoredPack | undefined) ?? null,
    createdAt: String(row.created_at),
    packReadyAt: row.pack_ready_at ? String(row.pack_ready_at) : null,
    followUps: (row.followups as ClaimRecord["followUps"] | null) ?? {},
    followUpsOptOut: Boolean(row.followups_opt_out),
  };
}

export function createSupabaseStore(config: SupabaseConfig, client?: SupabaseClient): ClaimStore {
  const db = client ?? createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  async function get(column: "id" | "pack_token", value: string) {
    const { data, error } = await db.from("claims").select(SELECT).eq(column, value).maybeSingle();
    if (error) throw new Error(`Failed to load claim: ${error.message}`);
    return data ? toRecord(data as Row) : null;
  }

  return {
    async createClaim(claim: NewClaim) {
      const { data, error } = await db
        .from("claims")
        .insert({
          pack_token: claim.packToken,
          answers: claim.answers,
          claim_input: claim.input,
          assessment: claim.assessment,
          regime: claim.regime,
          ruleset_version: claim.rulesetVersion,
          currency: claim.currency,
          total_amount: claim.totalAmount,
        })
        .select(SELECT)
        .single();
      if (error) throw new Error(`Failed to create claim: ${error.message}`);
      return toRecord(data as Row);
    },

    getById: (id) => get("id", id),
    getByPackToken: (token) => get("pack_token", token),

    async recordPaidOrder(order) {
      const { error } = await db.from("orders").insert({
        claim_id: order.claimId,
        provider: "paddle",
        provider_order_id: order.providerOrderId,
        status: "paid",
        email: order.email,
        amount_cents: order.amountCents,
        currency: order.currency,
        test_mode: order.testMode,
      });
      if (error?.code === UNIQUE_VIOLATION) return "duplicate";
      if (error) throw new Error(`Failed to record order: ${error.message}`);
      const { error: updateError } = await db
        .from("claims")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", order.claimId)
        .eq("status", "checkout_started");
      if (updateError) throw new Error(`Failed to mark claim paid: ${updateError.message}`);
      return "recorded";
    },

    async recordRefund(providerOrderId) {
      const { data, error } = await db
        .from("orders")
        .update({ status: "refunded" })
        .eq("provider_order_id", providerOrderId)
        .select("claim_id")
        .maybeSingle();
      if (error) throw new Error(`Failed to record refund: ${error.message}`);
      if (!data) return false;
      const { error: claimError } = await db
        .from("claims")
        .update({ status: "refunded", refunded_at: new Date().toISOString() })
        .eq("id", (data as Row).claim_id as string);
      if (claimError) throw new Error(`Failed to mark claim refunded: ${claimError.message}`);
      return true;
    },

    async saveDetailsAndPack(claimId, details, pack) {
      const now = new Date().toISOString();
      const { error } = await db
        .from("claim_details")
        .upsert({ claim_id: claimId, details, pack, updated_at: now }, { onConflict: "claim_id" });
      if (error) throw new Error(`Failed to save claim details: ${error.message}`);
      const { error: claimError } = await db.from("claims").update({ status: "pack_ready", pack_ready_at: now }).eq("id", claimId);
      if (claimError) throw new Error(`Failed to mark pack ready: ${claimError.message}`);
    },

    async listFollowUpCandidates(readyBefore) {
      const { data, error } = await db
        .from("claims")
        .select(SELECT)
        .eq("status", "pack_ready")
        .eq("followups_opt_out", false)
        .lte("pack_ready_at", readyBefore);
      if (error) throw new Error(`Failed to list follow-ups: ${error.message}`);
      return ((data ?? []) as Row[]).map(toRecord);
    },

    async markFollowUpSent(claimId: string, id: FollowUpId, at: string) {
      // Read-modify-write is fine: only the daily job writes this column.
      const { data, error } = await db.from("claims").select("followups").eq("id", claimId).maybeSingle();
      if (error) throw new Error(`Failed to read follow-ups: ${error.message}`);
      const followups = { ...(((data as Row | null)?.followups as Row | undefined) ?? {}), [id]: at };
      const { error: updateError } = await db.from("claims").update({ followups }).eq("id", claimId);
      if (updateError) throw new Error(`Failed to record follow-up: ${updateError.message}`);
    },

    async setFollowUpOptOut(packToken) {
      const { data, error } = await db.from("claims").update({ followups_opt_out: true }).eq("pack_token", packToken).select("id").maybeSingle();
      if (error) throw new Error(`Failed to opt out: ${error.message}`);
      return data !== null;
    },

    async purge(cutoffs) {
      const unpaid = await db.from("claims").delete({ count: "exact" }).eq("status", "checkout_started").lt("created_at", cutoffs.unpaidBefore);
      if (unpaid.error) throw new Error(`Failed to purge unpaid claims: ${unpaid.error.message}`);
      const refunded = await db.from("claims").delete({ count: "exact" }).eq("status", "refunded").lt("refunded_at", cutoffs.refundedBefore);
      if (refunded.error) throw new Error(`Failed to purge refunded claims: ${refunded.error.message}`);

      const old = await db.from("claims").select("id").eq("status", "pack_ready").lt("pack_ready_at", cutoffs.packDetailsBefore);
      if (old.error) throw new Error(`Failed to find expired packs: ${old.error.message}`);
      const ids = ((old.data ?? []) as Row[]).map((r) => String(r.id));
      if (ids.length > 0) {
        const details = await db.from("claim_details").delete().in("claim_id", ids);
        if (details.error) throw new Error(`Failed to delete claim details: ${details.error.message}`);
        const expired = await db.from("claims").update({ status: "expired", expired_at: new Date().toISOString() }).in("id", ids);
        if (expired.error) throw new Error(`Failed to expire claims: ${expired.error.message}`);
      }
      return { unpaidDeleted: unpaid.count ?? 0, refundedDeleted: refunded.count ?? 0, packsExpired: ids.length };
    },
  };
}
