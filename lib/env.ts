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
  secretKey: string;
  priceIds: Record<Currency, string>;
  webhookSecret: string;
  /** Stripe Managed Payments: Stripe is merchant of record and handles VAT (on unless STRIPE_MANAGED_PAYMENTS=false). */
  managedPayments: boolean;
  /** Without Managed Payments: let Stripe Tax calculate VAT at checkout (needs your own tax registrations). */
  automaticTax: boolean;
}

export function paymentsConfig(): PaymentsConfig | null {
  const secretKey = read("STRIPE_SECRET_KEY");
  const eur = read("STRIPE_PRICE_ID_EUR");
  const gbp = read("STRIPE_PRICE_ID_GBP");
  const webhookSecret = read("STRIPE_WEBHOOK_SECRET");
  return secretKey && eur && gbp && webhookSecret
    ? {
        secretKey,
        priceIds: { EUR: eur, GBP: gbp },
        webhookSecret,
        managedPayments: read("STRIPE_MANAGED_PAYMENTS") !== "false",
        automaticTax: read("STRIPE_AUTOMATIC_TAX") === "true",
      }
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
