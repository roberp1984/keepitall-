// Server-only. Paddle Billing API (https://developer.paddle.com) via fetch.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaddleEnvironment, PaymentsConfig } from "../env";
import type { Currency } from "../rules/types";

const API_BASE: Record<PaddleEnvironment, string> = {
  sandbox: "https://sandbox-api.paddle.com",
  production: "https://api.paddle.com",
};

type Fetch = typeof fetch;

/** Calls the Paddle API and returns `data`, or throws with Paddle's error detail (never the key). */
export async function paddleApi<T>(
  config: Pick<PaymentsConfig, "apiKey" | "environment">,
  path: string,
  init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
  fetchImpl: Fetch = fetch,
): Promise<T> {
  const res = await fetchImpl(`${API_BASE[config.environment]}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { data?: T; error?: { code?: string; detail?: string } } | null;
  if (!res.ok || !json || json.data === undefined) {
    const detail = json?.error ? `${json.error.code ?? "error"}: ${json.error.detail ?? ""}` : `HTTP ${res.status}`;
    throw new Error(`Paddle ${path.split("?")[0]} failed (${detail})`);
  }
  return json.data;
}

export interface CheckoutRequest {
  claimId: string;
  currency: Currency;
}

/** Creates a ready-to-pay transaction; the browser opens it with Paddle.js. Prices are fixed server-side. */
export async function createTransaction(config: PaymentsConfig, req: CheckoutRequest, fetchImpl?: Fetch): Promise<string> {
  const data = await paddleApi<{ id: string }>(
    config,
    "/transactions",
    {
      method: "POST",
      body: { items: [{ price_id: config.priceIds[req.currency], quantity: 1 }], custom_data: { claim_id: req.claimId } },
    },
    fetchImpl,
  );
  return data.id;
}

export async function customerEmail(config: PaymentsConfig, customerId: string, fetchImpl?: Fetch): Promise<string> {
  const data = await paddleApi<{ email?: string }>(config, `/customers/${encodeURIComponent(customerId)}`, {}, fetchImpl);
  if (!data.email) throw new Error("Paddle customer has no email");
  return data.email;
}

/** Max age of a webhook signature, against replays. */
const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Paddle-Signature: `ts=<unix seconds>;h1=<hex HMAC-SHA256 of "<ts>:<raw body>">`.
 * Several h1 values can be present while a secret is being rotated.
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  let ts: string | undefined;
  const hashes: string[] = [];
  for (const part of header.split(";")) {
    const [key, value] = part.split("=", 2).map((s) => s.trim());
    if (key === "ts") ts = value;
    else if (key === "h1" && value) hashes.push(value);
  }
  if (!ts || !/^\d+$/.test(ts) || hashes.length === 0) return false;
  if (Math.abs(nowSeconds - Number(ts)) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`, "utf8").digest();
  return hashes.some((h) => {
    if (!/^[0-9a-f]+$/i.test(h)) return false;
    const given = Buffer.from(h, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export type WebhookEvent =
  | { type: "order_paid"; claimId: string; orderId: string; customerId: string; amountCents: number; currency: string }
  | { type: "order_refunded"; orderId: string }
  | { type: "ignored"; reason: string };

const obj = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Narrows an untrusted webhook payload to the events we act on. */
export function parseWebhookEvent(payload: unknown): WebhookEvent {
  const root = obj(payload);
  const data = obj(root?.data);
  const eventType = root?.event_type;
  if (!data || typeof eventType !== "string") return { type: "ignored", reason: "malformed payload" };

  if (eventType === "adjustment.created" || eventType === "adjustment.updated") {
    if (data.action !== "refund") return { type: "ignored", reason: `adjustment action ${String(data.action)}` };
    if (data.status !== "approved") return { type: "ignored", reason: `refund status ${String(data.status)}` };
    if (data.type === "partial") return { type: "ignored", reason: "partial refund" };
    if (typeof data.transaction_id !== "string" || !data.transaction_id) return { type: "ignored", reason: "missing transaction id" };
    return { type: "order_refunded", orderId: data.transaction_id };
  }

  if (eventType !== "transaction.completed") return { type: "ignored", reason: `unhandled event ${eventType}` };
  const orderId = typeof data.id === "string" ? data.id : "";
  if (!orderId) return { type: "ignored", reason: "missing transaction id" };
  const claimId = obj(data.custom_data)?.claim_id;
  if (typeof claimId !== "string" || !claimId) return { type: "ignored", reason: "missing claim_id" };
  if (typeof data.customer_id !== "string" || !data.customer_id) return { type: "ignored", reason: "missing customer" };

  const totals = obj(obj(data.details)?.totals);
  return {
    type: "order_paid",
    claimId,
    orderId,
    customerId: data.customer_id,
    amountCents: Number(totals?.grand_total ?? totals?.total ?? 0),
    currency: String(data.currency_code ?? ""),
  };
}
