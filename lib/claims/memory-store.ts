import { randomUUID } from "node:crypto";
import type { ClaimRecord, ClaimStore, DetailsForm, NewClaim, PaidOrder, StoredPack } from "./types";

interface OrderRow extends PaidOrder {
  status: "paid" | "refunded";
}

/** In-memory ClaimStore for tests and local development without Supabase. */
export function createMemoryStore(): ClaimStore & { orders: OrderRow[] } {
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
    },
  };
}
