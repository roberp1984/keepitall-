// Server-only: real SDK clients for the setup checks.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailConfig, siteUrl, supabaseConfig } from "../env";
import { stripeClient } from "../payments/stripe";
import { DEFAULT_LETTER_MODEL } from "../letters/anthropic";
import type { EnvSnapshot, SetupClients } from "./checks";

const read = (key: string) => process.env[key]?.trim() || null;

export function envSnapshot(): EnvSnapshot {
  const secretKey = read("STRIPE_SECRET_KEY");
  const eur = read("STRIPE_PRICE_ID_EUR");
  const gbp = read("STRIPE_PRICE_ID_GBP");
  return {
    siteUrl: read("NEXT_PUBLIC_SITE_URL") ? siteUrl() : null,
    supabase: supabaseConfig() !== null,
    stripe:
      secretKey && eur && gbp
        ? {
            mode: secretKey.includes("_live_") ? "live" : "test",
            priceIds: { EUR: eur, GBP: gbp },
            webhookSecret: Boolean(read("STRIPE_WEBHOOK_SECRET")),
            automaticTax: read("STRIPE_AUTOMATIC_TAX") === "true",
          }
        : null,
    emailFrom: read("EMAIL_FROM"),
    resend: emailConfig() !== null,
    anthropicModel: read("ANTHROPIC_API_KEY") ? (read("ANTHROPIC_MODEL") ?? DEFAULT_LETTER_MODEL) : null,
    posthogKey: read("NEXT_PUBLIC_POSTHOG_KEY"),
    cronSecretLength: read("CRON_SECRET")?.length ?? 0,
  };
}

export function realSetupClients(): SetupClients {
  const stripe = stripeClient({ secretKey: read("STRIPE_SECRET_KEY") ?? "" });
  return {
    async probeClaims(columns) {
      const db = supabaseConfig();
      if (!db) return "not configured";
      const client = createClient(db.url, db.serviceRoleKey, { auth: { persistSession: false } });
      const { error } = await client.from("claims").select(columns).limit(1);
      return error ? error.message : null;
    },
    async stripePrice(priceId) {
      const p = await stripe.prices.retrieve(priceId, { expand: ["product"] });
      const product = typeof p.product === "object" && "name" in p.product ? p.product.name : "";
      return {
        name: p.nickname ?? product ?? p.id,
        amountCents: p.unit_amount ?? 0,
        currency: p.currency.toUpperCase(),
        active: p.active,
        recurring: p.type === "recurring",
        taxBehavior: p.tax_behavior ?? "unspecified",
      };
    },
    async stripeWebhooks() {
      const list = await stripe.webhookEndpoints.list({ limit: 100 });
      return list.data.map((w) => ({ url: w.url, events: w.enabled_events, enabled: w.status === "enabled" }));
    },
    async resendDomains() {
      const { data, error } = await new Resend(read("RESEND_API_KEY")!).domains.list();
      if (error || !data) throw new Error(error?.message ?? "empty response");
      return data.data.map((d) => ({ name: d.name, status: d.status }));
    },
    async anthropicModel(model) {
      await new Anthropic().models.retrieve(model);
    },
  };
}
