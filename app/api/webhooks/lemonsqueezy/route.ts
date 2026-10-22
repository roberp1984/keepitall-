import { handleOrderPaid, handleOrderRefunded } from "@/lib/claims/service";
import { paymentsConfig } from "@/lib/env";
import { parseWebhookEvent, verifyWebhookSignature } from "@/lib/payments/lemonsqueezy";
import { serviceDeps } from "@/lib/server/deps";

/** Lemon Squeezy webhook: the single source of truth for "paid". */
export async function POST(request: Request) {
  const payments = paymentsConfig();
  if (!payments) {
    console.error("[webhook] rejected: payments not configured");
    return new Response("Payments not configured", { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get("x-signature");
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
      const result = await handleOrderPaid(deps, event);
      // Unknown claim: acknowledge so Lemon Squeezy stops retrying, but log it.
      if (result === "unknown_claim") console.error("[webhook] order for unknown claim", { claimId: event.claimId, orderId: event.orderId });
      return Response.json({ ok: true, result });
    }
    case "order_refunded":
      return Response.json({ ok: true, result: (await handleOrderRefunded(deps, event.orderId)) ? "refunded" : "unknown_order" });
    case "ignored":
      return Response.json({ ok: true, result: "ignored", reason: event.reason });
  }
}
