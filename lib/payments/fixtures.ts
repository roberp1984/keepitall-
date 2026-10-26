/** Paddle webhook payloads, shaped like the real ones. */
export function transactionPayload(
  overrides: { event?: string; claimId?: string | null; customerId?: string | null; id?: string } = {},
) {
  return {
    event_id: "evt_01",
    event_type: overrides.event ?? "transaction.completed",
    occurred_at: "2026-10-26T10:00:00Z",
    notification_id: "ntf_01",
    data: {
      id: overrides.id ?? "txn_01",
      status: "completed",
      customer_id: overrides.customerId === null ? null : (overrides.customerId ?? "ctm_01"),
      currency_code: "EUR",
      custom_data: overrides.claimId === null ? null : { claim_id: overrides.claimId ?? "claim-1" },
      details: { totals: { subtotal: "1597", tax: "303", total: "1900", grand_total: "1900" } },
    },
  };
}

export function refundPayload(
  overrides: { event?: string; status?: string; action?: string; type?: string; transactionId?: string } = {},
) {
  return {
    event_id: "evt_02",
    event_type: overrides.event ?? "adjustment.updated",
    occurred_at: "2026-10-27T10:00:00Z",
    notification_id: "ntf_02",
    data: {
      id: "adj_01",
      action: overrides.action ?? "refund",
      type: overrides.type ?? "full",
      status: overrides.status ?? "approved",
      transaction_id: overrides.transactionId ?? "txn_01",
    },
  };
}
