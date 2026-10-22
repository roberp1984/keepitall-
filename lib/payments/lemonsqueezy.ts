// Server-only.
import { createCheckout, lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentsConfig } from "../env";
import type { Currency } from "../rules/types";

export interface CheckoutRequest {
  claimId: string;
  currency: Currency;
  /** Where Lemon Squeezy sends the customer after paying. */
  redirectUrl: string;
}

export async function createCheckoutUrl(config: PaymentsConfig, req: CheckoutRequest): Promise<string> {
  lemonSqueezySetup({ apiKey: config.apiKey });
  const { data, error } = await createCheckout(config.storeId, config.variantIds[req.currency], {
    checkoutData: { custom: { claim_id: req.claimId } },
    productOptions: {
      redirectUrl: req.redirectUrl,
      receiptLinkUrl: req.redirectUrl,
      receiptButtonText: "Open your claim pack",
    },
  });
  if (error) throw new Error(`Lemon Squeezy checkout failed: ${error.message}`);
  return data.data.attributes.url;
}

/** Lemon Squeezy signs the raw body with HMAC-SHA256 (hex) in the X-Signature header. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[0-9a-f]+$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
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

/** Narrows an untrusted webhook payload to the events we act on. */
export function parseWebhookEvent(payload: unknown): WebhookEvent {
  const root = obj(payload);
  const meta = obj(root?.meta);
  const data = obj(root?.data);
  const attrs = obj(data?.attributes);
  const eventName = meta?.event_name;
  if (!meta || !data || !attrs || typeof eventName !== "string") return { type: "ignored", reason: "malformed payload" };
  const orderId = data.id === undefined ? "" : String(data.id);
  if (!orderId) return { type: "ignored", reason: "missing order id" };

  if (eventName === "order_refunded") return { type: "order_refunded", orderId };
  if (eventName !== "order_created") return { type: "ignored", reason: `unhandled event ${eventName}` };
  if (attrs.status !== "paid") return { type: "ignored", reason: `order status ${String(attrs.status)}` };

  const claimId = obj(meta.custom_data)?.claim_id;
  if (typeof claimId !== "string" || !claimId) return { type: "ignored", reason: "missing claim_id" };
  if (typeof attrs.user_email !== "string" || !attrs.user_email) return { type: "ignored", reason: "missing email" };

  return {
    type: "order_paid",
    claimId,
    orderId,
    email: attrs.user_email,
    amountCents: Number(attrs.total ?? 0),
    currency: String(attrs.currency ?? ""),
    testMode: Boolean(meta.test_mode),
  };
}
