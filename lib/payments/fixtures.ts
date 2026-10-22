/** A Lemon Squeezy order webhook payload, shaped like the real one. */
export function orderPayload(overrides: { event?: string; status?: string; claimId?: string | null; email?: string } = {}) {
  return {
    meta: {
      event_name: overrides.event ?? "order_created",
      test_mode: true,
      custom_data: overrides.claimId === null ? {} : { claim_id: overrides.claimId ?? "claim-1" },
    },
    data: {
      id: "12345",
      type: "orders",
      attributes: { status: overrides.status ?? "paid", user_email: overrides.email ?? "alex@example.com", total: 1700, currency: "GBP" },
    },
  };
}
