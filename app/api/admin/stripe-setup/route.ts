// TEMPORARY admin tool: creates the Stripe product, prices and webhook endpoint. Remove after setup.
import { timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/lib/env";
import { stripeClient } from "@/lib/payments/stripe";
import { packPrice } from "@/lib/pricing";

const WEBHOOK_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "charge.refunded"] as const;
const PRICES = [
  { key: "EUR" as const, lookupKey: "keepitall_claim_pack_eur", nickname: "EU261 claim" },
  { key: "GBP" as const, lookupKey: "keepitall_claim_pack_gbp", nickname: "UK261 claim" },
];

function authorized(given: string | null): boolean {
  const expected = process.env.SETUP_ADMIN_TOKEN?.trim();
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!authorized(url.searchParams.get("token")) || !secretKey) return new Response("Not found", { status: 404 });
  const stripe = stripeClient({ secretKey });
  const apply = url.searchParams.get("action") === "setup";
  const webhookUrl = `${siteUrl()}/api/webhooks/stripe`;

  try {
    const account = await stripe.accounts.retrieveCurrent();
    const mode = secretKey.includes("_live_") ? "live" : "test";

    let product = (await stripe.products.list({ limit: 100 })).data.find((p) => p.metadata.keepitall === "claim_pack");
    if (!product && apply) {
      product = await stripe.products.create({
        name: "Claim pack",
        description: "Personalised flight compensation claim pack (EU261/UK261): claim letter, escalation letter, reply templates and PDF.",
        metadata: { keepitall: "claim_pack" },
        tax_code: "txcd_10000000",
      });
    }

    const existing = await stripe.prices.list({ lookup_keys: PRICES.map((p) => p.lookupKey), limit: 10 });
    const priceIds: Record<string, string | null> = {};
    for (const p of PRICES) {
      let price = existing.data.find((x) => x.lookup_key === p.lookupKey);
      if (!price && apply && product) {
        const amount = packPrice(p.key);
        price = await stripe.prices.create({
          product: product.id,
          currency: amount.currency.toLowerCase(),
          unit_amount: Math.round(amount.amount * 100),
          tax_behavior: "inclusive",
          lookup_key: p.lookupKey,
          nickname: p.nickname,
        });
      }
      priceIds[p.key] = price?.id ?? null;
    }

    let hook = (await stripe.webhookEndpoints.list({ limit: 100 })).data.find((w) => w.url === webhookUrl);
    let webhookSecret: string | undefined;
    if (apply) {
      if (hook) {
        hook = await stripe.webhookEndpoints.update(hook.id, { enabled_events: [...WEBHOOK_EVENTS], disabled: false });
      } else {
        const created = await stripe.webhookEndpoints.create({
          url: webhookUrl,
          enabled_events: [...WEBHOOK_EVENTS],
          description: "KeepItAll website",
        });
        hook = created;
        webhookSecret = created.secret;
      }
    }

    return Response.json({
      mode,
      account: { id: account.id, country: account.country, chargesEnabled: account.charges_enabled, name: account.business_profile?.name ?? null },
      productId: product?.id ?? null,
      priceIds,
      webhook: hook ? { id: hook.id, url: hook.url, status: hook.status, events: hook.enabled_events } : null,
      // Only returned once, when the endpoint is created.
      webhookSecret: webhookSecret ?? null,
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
