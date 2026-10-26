// Server-only: real SDK clients for the setup checks.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailConfig, paddleEnvironment, siteUrl, supabaseConfig } from "../env";
import { paddleApi } from "../payments/paddle";
import { DEFAULT_LETTER_MODEL } from "../letters/anthropic";
import type { EnvSnapshot, SetupClients } from "./checks";

const read = (key: string) => process.env[key]?.trim() || null;

export function envSnapshot(): EnvSnapshot {
  const apiKey = read("PADDLE_API_KEY");
  const eur = read("PADDLE_PRICE_ID_EUR");
  const gbp = read("PADDLE_PRICE_ID_GBP");
  return {
    siteUrl: read("NEXT_PUBLIC_SITE_URL") ? siteUrl() : null,
    supabase: supabaseConfig() !== null,
    paddle:
      apiKey && eur && gbp
        ? {
            environment: paddleEnvironment(apiKey),
            priceIds: { EUR: eur, GBP: gbp },
            webhookSecret: Boolean(read("PADDLE_WEBHOOK_SECRET")),
            clientToken: read("PADDLE_CLIENT_TOKEN"),
          }
        : null,
    emailFrom: read("EMAIL_FROM"),
    resend: emailConfig() !== null,
    anthropicModel: read("ANTHROPIC_API_KEY") ? (read("ANTHROPIC_MODEL") ?? DEFAULT_LETTER_MODEL) : null,
    posthogKey: read("NEXT_PUBLIC_POSTHOG_KEY"),
    cronSecretLength: read("CRON_SECRET")?.length ?? 0,
  };
}

interface PaddlePrice {
  description: string;
  status: string;
  billing_cycle: unknown;
  unit_price: { amount: string; currency_code: string };
}

interface PaddleDestination {
  destination: string;
  active: boolean;
  subscribed_events: { name: string }[];
}

export function realSetupClients(): SetupClients {
  const apiKey = read("PADDLE_API_KEY") ?? "";
  const paddle = { apiKey, environment: paddleEnvironment(apiKey) };
  return {
    async probeClaims(columns) {
      const db = supabaseConfig();
      if (!db) return "not configured";
      const client = createClient(db.url, db.serviceRoleKey, { auth: { persistSession: false } });
      const { error } = await client.from("claims").select(columns).limit(1);
      return error ? error.message : null;
    },
    async paddlePrice(priceId) {
      const p = await paddleApi<PaddlePrice>(paddle, `/prices/${encodeURIComponent(priceId)}`);
      return {
        name: p.description,
        amountCents: Number(p.unit_price.amount),
        currency: p.unit_price.currency_code,
        status: p.status,
        recurring: p.billing_cycle != null,
      };
    },
    async paddleWebhooks() {
      const list = await paddleApi<PaddleDestination[]>(paddle, "/notification-settings");
      return list.map((d) => ({ url: d.destination, events: d.subscribed_events.map((e) => e.name), active: d.active }));
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
