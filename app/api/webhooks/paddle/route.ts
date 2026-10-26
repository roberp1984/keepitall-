import { handleOrderPaid, handleOrderRefunded } from "@/lib/claims/service";
import { paymentsConfig } from "@/lib/env";
import { customerEmail, parseWebhookEvent, verifyWebhookSignature } from "@/lib/payments/paddle";
import { serviceDeps } from "@/lib/server/deps";

/** Paddle webhook: the single source of truth for "paid". */
export async function POST(request: Request) {
  const payments = paymentsConfig();
  if (!payments) {
    console.error("[webhook] rejected: payments not configured");
    return new Response("Payments not configured", { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get("paddle-signature");
  if (!verifyWebhookSignature(raw, signature, payments.webhookSecret)) {
    // Never log the secret or the signature itself.
    console.error("[webhook] rejected: invalid signature", { hasSignature: Boolean(signature), bodyBytes: raw.length });
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = parseWebhookEvent(payload);
  console.info("[webhook] received", { type: event.type, ...(event.type === "ignored" ? { reason: event.reason } : { orderId: event.orderId }) });
  const deps = serviceDeps();
  switch (event.type) {
    case "order_paid": {
      let email: string;
      try {
        email = await customerEmail(payments, event.customerId);
      } catch (err) {
        // 5xx makes Paddle retry later.
        console.error("[webhook] couldn't load customer email", { orderId: event.orderId, error: (err as Error).message });
        return new Response("Customer lookup failed", { status: 502 });
      }
      const result = await handleOrderPaid(deps, {
        claimId: event.claimId,
        orderId: event.orderId,
        email,
        amountCents: event.amountCents,
        currency: event.currency,
        testMode: payments.environment === "sandbox",
      });
      // Unknown claim: acknowledge so Paddle stops retrying, but log it.
      if (result === "unknown_claim") console.error("[webhook] order for unknown claim", { claimId: event.claimId, orderId: event.orderId });
      return Response.json({ ok: true, result });
    }
    case "order_refunded":
      return Response.json({ ok: true, result: (await handleOrderRefunded(deps, event.orderId)) ? "refunded" : "unknown_order" });
    case "ignored":
      return Response.json({ ok: true, result: "ignored", reason: event.reason });
  }
}
