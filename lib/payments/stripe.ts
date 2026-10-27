// Server-only. Stripe Checkout (hosted page) for one-off claim pack payments.
import Stripe from "stripe";
import type { PaymentsConfig } from "../env";
import type { Currency } from "../rules/types";

export function stripeClient(config: Pick<PaymentsConfig, "secretKey">): Stripe {
  return new Stripe(config.secretKey);
}

export interface CheckoutRequest {
  claimId: string;
  currency: Currency;
  /** Where Stripe sends the customer after paying. */
  successUrl: string;
  /** Where Stripe sends the customer if they go back. */
  cancelUrl: string;
}

type SessionCreator = Pick<Stripe["checkout"]["sessions"], "create">;

/** Creates a hosted Checkout Session; the price is fixed server-side. */
export async function createCheckoutUrl(
  config: PaymentsConfig,
  req: CheckoutRequest,
  sessions: SessionCreator = stripeClient(config).checkout.sessions,
): Promise<string> {
  const session = await sessions.create({
    mode: "payment",
    line_items: [{ price: config.priceIds[req.currency], quantity: 1 }],
    client_reference_id: req.claimId,
    metadata: { claim_id: req.claimId },
    success_url: req.successUrl,
    cancel_url: req.cancelUrl,
    locale: "en",
    // Managed Payments sets tax and billing-address collection itself; they can't be passed alongside it.
    ...(config.managedPayments
      ? { managed_payments: { enabled: true } }
      : config.automaticTax
        ? { automatic_tax: { enabled: true }, billing_address_collection: "required" as const }
        : {}),
  });
  if (!session.url) throw new Error("Stripe returned a session without a URL");
  return session.url;
}

/** Verifies the Stripe-Signature header and returns the parsed event, or null. */
export function verifyWebhook(rawBody: string, signature: string | null, config: PaymentsConfig): unknown {
  if (!signature) return null;
  try {
    return stripeClient(config).webhooks.constructEvent(rawBody, signature, config.webhookSecret);
  } catch {
    return null;
  }
}

export type WebhookEvent =
  | {
      type: "order_paid";
      claimId: string;
      orderId: string;
      email: string;
      amountCents: number;
      currency: string;
      testMode: boolean;
    }
  | { type: "order_refunded"; orderId: string }
  | { type: "ignored"; reason: string };

const obj = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const idOf = (v: unknown): string | null => (typeof v === "string" ? v : typeof obj(v)?.id === "string" ? (obj(v)!.id as string) : null);

const PAID_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];

/** Narrows a (signature-verified) Stripe event to the events we act on. Order id = PaymentIntent id. */
export function parseWebhookEvent(event: unknown): WebhookEvent {
  const root = obj(event);
  const data = obj(obj(root?.data)?.object);
  const type = root?.type;
  if (!data || typeof type !== "string") return { type: "ignored", reason: "malformed event" };

  if (type === "charge.refunded") {
    if (data.refunded !== true) return { type: "ignored", reason: "partial refund" };
    const orderId = idOf(data.payment_intent);
    return orderId ? { type: "order_refunded", orderId } : { type: "ignored", reason: "missing payment intent" };
  }

  if (!PAID_EVENTS.includes(type)) return { type: "ignored", reason: `unhandled event ${type}` };
  if (data.payment_status !== "paid") return { type: "ignored", reason: `payment status ${String(data.payment_status)}` };
  const orderId = idOf(data.payment_intent);
  if (!orderId) return { type: "ignored", reason: "missing payment intent" };
  const claimId = obj(data.metadata)?.claim_id ?? data.client_reference_id;
  if (typeof claimId !== "string" || !claimId) return { type: "ignored", reason: "missing claim_id" };
  const email = obj(data.customer_details)?.email;
  if (typeof email !== "string" || !email) return { type: "ignored", reason: "missing email" };

  return {
    type: "order_paid",
    claimId,
    orderId,
    email,
    amountCents: Number(data.amount_total ?? 0),
    currency: String(data.currency ?? "").toUpperCase(),
    testMode: root?.livemode !== true,
  };
}
