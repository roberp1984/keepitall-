// Server-only: real SDK clients for the setup checks.
import Anthropic from "@anthropic-ai/sdk";
import { getStore, getVariant, lemonSqueezySetup, listWebhooks } from "@lemonsqueezy/lemonsqueezy.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailConfig, paymentsConfig, siteUrl, supabaseConfig } from "../env";
import { DEFAULT_LETTER_MODEL } from "../letters/anthropic";
import type { EnvSnapshot, SetupClients } from "./checks";

const read = (key: string) => process.env[key]?.trim() || null;

export function envSnapshot(): EnvSnapshot {
  const payments = paymentsConfig();
  const lemonPartial = read("LEMONSQUEEZY_API_KEY") && read("LEMONSQUEEZY_STORE_ID");
  return {
    siteUrl: read("NEXT_PUBLIC_SITE_URL") ? siteUrl() : null,
    supabase: supabaseConfig() !== null,
    lemon: payments
      ? { storeId: payments.storeId, variantIds: payments.variantIds, webhookSecret: true }
      : lemonPartial && read("LEMONSQUEEZY_VARIANT_ID_EUR") && read("LEMONSQUEEZY_VARIANT_ID_GBP")
        ? {
            storeId: read("LEMONSQUEEZY_STORE_ID")!,
            variantIds: { EUR: read("LEMONSQUEEZY_VARIANT_ID_EUR")!, GBP: read("LEMONSQUEEZY_VARIANT_ID_GBP")! },
            webhookSecret: false,
          }
        : null,
    emailFrom: read("EMAIL_FROM"),
    resend: emailConfig() !== null,
    anthropicModel: read("ANTHROPIC_API_KEY") ? (read("ANTHROPIC_MODEL") ?? DEFAULT_LETTER_MODEL) : null,
    posthogKey: read("NEXT_PUBLIC_POSTHOG_KEY"),
    cronSecretLength: read("CRON_SECRET")?.length ?? 0,
  };
}

function unwrap<T>(res: { data: T | null; error: Error | null }): T {
  if (res.error || !res.data) throw res.error ?? new Error("empty response");
  return res.data;
}

export function realSetupClients(): SetupClients {
  const lemonKey = read("LEMONSQUEEZY_API_KEY");
  if (lemonKey) lemonSqueezySetup({ apiKey: lemonKey });
  return {
    async probeClaims(columns) {
      const db = supabaseConfig();
      if (!db) return "not configured";
      const client = createClient(db.url, db.serviceRoleKey, { auth: { persistSession: false } });
      const { error } = await client.from("claims").select(columns).limit(1);
      return error ? error.message : null;
    },
    async lemonStore(storeId) {
      const a = unwrap(await getStore(storeId)).data.attributes;
      return { name: a.name, currency: a.currency };
    },
    async lemonVariant(variantId) {
      const a = unwrap(await getVariant(variantId)).data.attributes;
      return { name: a.name, price: a.price, status: a.status };
    },
    async lemonWebhooks(storeId) {
      return unwrap(await listWebhooks({ filter: { storeId } })).data.map((w) => ({
        url: w.attributes.url,
        events: w.attributes.events,
        testMode: w.attributes.test_mode,
      }));
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
