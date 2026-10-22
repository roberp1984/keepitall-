// Server-only configuration. Every integration is optional so the free check runs without any keys.
import type { Currency } from "./rules/types";

const read = (key: string): string | undefined => process.env[key]?.trim() || undefined;

export function siteUrl(): string {
  return (read("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
}

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export function supabaseConfig(): SupabaseConfig | null {
  const url = read("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = read("SUPABASE_SERVICE_ROLE_KEY");
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

export interface PaymentsConfig {
  apiKey: string;
  storeId: string;
  variantIds: Record<Currency, string>;
  webhookSecret: string;
}

export function paymentsConfig(): PaymentsConfig | null {
  const apiKey = read("LEMONSQUEEZY_API_KEY");
  const storeId = read("LEMONSQUEEZY_STORE_ID");
  const eur = read("LEMONSQUEEZY_VARIANT_ID_EUR");
  const gbp = read("LEMONSQUEEZY_VARIANT_ID_GBP");
  const webhookSecret = read("LEMONSQUEEZY_WEBHOOK_SECRET");
  return apiKey && storeId && eur && gbp && webhookSecret
    ? { apiKey, storeId, variantIds: { EUR: eur, GBP: gbp }, webhookSecret }
    : null;
}

export interface EmailConfig {
  apiKey: string;
  from: string;
}

export function emailConfig(): EmailConfig | null {
  const apiKey = read("RESEND_API_KEY");
  const from = read("EMAIL_FROM");
  return apiKey && from ? { apiKey, from } : null;
}

export function anthropicConfigured(): boolean {
  return Boolean(read("ANTHROPIC_API_KEY"));
}

/** Checkout needs payments and a database; email is optional (the pack page still works). */
export function checkoutEnabled(): boolean {
  return paymentsConfig() !== null && supabaseConfig() !== null;
}
