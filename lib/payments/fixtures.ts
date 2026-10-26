/** Stripe webhook events, shaped like the real ones. */
export function sessionEvent(
  overrides: { type?: string; claimId?: string | null; email?: string | null; paymentStatus?: string; paymentIntent?: string } = {},
) {
  return {
    id: "evt_1",
    object: "event",
    type: overrides.type ?? "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        payment_status: overrides.paymentStatus ?? "paid",
        payment_intent: overrides.paymentIntent ?? "pi_1",
        amount_total: 1900,
        currency: "eur",
        client_reference_id: overrides.claimId === null ? null : (overrides.claimId ?? "claim-1"),
        metadata: overrides.claimId === null ? {} : { claim_id: overrides.claimId ?? "claim-1" },
        customer_details: { email: overrides.email === null ? null : (overrides.email ?? "alex@example.com") },
      },
    },
  };
}

export function refundEvent(overrides: { refunded?: boolean; paymentIntent?: string } = {}) {
  return {
    id: "evt_2",
    object: "event",
    type: "charge.refunded",
    livemode: false,
    data: {
      object: {
        id: "ch_1",
        object: "charge",
        refunded: overrides.refunded ?? true,
        amount: 1900,
        amount_refunded: overrides.refunded === false ? 500 : 1900,
        payment_intent: overrides.paymentIntent ?? "pi_1",
      },
    },
  };
}
