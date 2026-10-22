import { randomUUID } from "node:crypto";
import type { ClaimRecord, ClaimStore, DetailsForm, NewClaim, PaidOrder, PurgeCutoffs, StoredPack } from "./types";

interface OrderRow extends PaidOrder {
  status: "paid" | "refunded";
  refundedAt?: string;
}

/** In-memory ClaimStore for tests and local development without Supabase. */
export function createMemoryStore(): ClaimStore & { orders: OrderRow[]; _set(id: string, patch: Partial<ClaimRecord>): void } {
  const claims = new Map<string, ClaimRecord>();
  const orders: OrderRow[] = [];
  const clone = <T>(v: T): T => structuredClone(v);

  return {
    orders,
    async createClaim(claim: NewClaim) {
      const record: ClaimRecord = {
        ...clone(claim),
        id: randomUUID(),
        status: "checkout_started",
        orderEmail: null,
        details: null,
        pack: null,
        createdAt: new Date().toISOString(),
        packReadyAt: null,
        followUps: {},
        followUpsOptOut: false,
      };
      claims.set(record.id, record);
      return clone(record);
    },
    async getById(id) {
      const c = claims.get(id);
      return c ? clone(c) : null;
    },
    async getByPackToken(token) {
      const c = [...claims.values()].find((x) => x.packToken === token);
      return c ? clone(c) : null;
    },
    async recordPaidOrder(order) {
      if (orders.some((o) => o.providerOrderId === order.providerOrderId)) return "duplicate";
      const claim = claims.get(order.claimId);
      if (!claim) throw new Error(`Unknown claim ${order.claimId}`);
      orders.push({ ...order, status: "paid" });
      claim.orderEmail = order.email;
      if (claim.status === "checkout_started") claim.status = "paid";
      return "recorded";
    },
    async recordRefund(providerOrderId) {
      const order = orders.find((o) => o.providerOrderId === providerOrderId);
      if (!order) return false;
      order.status = "refunded";
      order.refundedAt = new Date().toISOString();
      const claim = claims.get(order.claimId);
      if (claim) claim.status = "refunded";
      return true;
    },
    async saveDetailsAndPack(claimId: string, details: DetailsForm, pack: StoredPack) {
      const claim = claims.get(claimId);
      if (!claim) throw new Error(`Unknown claim ${claimId}`);
      claim.details = clone(details);
      claim.pack = clone(pack);
      claim.status = "pack_ready";
      claim.packReadyAt = new Date().toISOString();
    },
    async listFollowUpCandidates(readyBefore) {
      return [...claims.values()]
        .filter((c) => c.status === "pack_ready" && !c.followUpsOptOut && c.packReadyAt !== null && c.packReadyAt <= readyBefore)
        .map(clone);
    },
    async markFollowUpSent(claimId, id, at) {
      const claim = claims.get(claimId);
      if (claim) claim.followUps[id] = at;
    },
    async setFollowUpOptOut(packToken) {
      const claim = [...claims.values()].find((c) => c.packToken === packToken);
      if (!claim) return false;
      claim.followUpsOptOut = true;
      return true;
    },
    async purge(cutoffs: PurgeCutoffs) {
      const refundedAt = (c: ClaimRecord) => orders.find((o) => o.claimId === c.id && o.refundedAt)?.refundedAt ?? c.createdAt;
      let unpaidDeleted = 0;
      let refundedDeleted = 0;
      let packsExpired = 0;
      for (const [id, c] of claims) {
        if (c.status === "checkout_started" && c.createdAt < cutoffs.unpaidBefore) {
          claims.delete(id);
          unpaidDeleted++;
        } else if (c.status === "refunded" && refundedAt(c) < cutoffs.refundedBefore) {
          claims.delete(id);
          refundedDeleted++;
        } else if (c.status === "pack_ready" && c.packReadyAt && c.packReadyAt < cutoffs.packDetailsBefore) {
          c.details = null;
          c.pack = null;
          c.status = "expired";
          packsExpired++;
        }
      }
      return { unpaidDeleted, refundedDeleted, packsExpired };
    },
    /** Test helper: move timestamps into the past. */
    _set(id: string, patch: Partial<ClaimRecord>) {
      Object.assign(claims.get(id)!, patch);
    },
  };
}
