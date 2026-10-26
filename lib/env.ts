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

export type PaddleEnvironment = "sandbox" | "production";

export interface PaymentsConfig {
  apiKey: string;
  environment: PaddleEnvironment;
  priceIds: Record<Currency, string>;
  webhookSecret: string;
  /** Client-side token for Paddle.js (not secret): test_… in sandbox, live_… in production. */
  clientToken: string;
}

/** Sandbox keys contain `_sdbx_`; PADDLE_ENVIRONMENT overrides. */
export function paddleEnvironment(apiKey: string | undefined): PaddleEnvironment {
  const explicit = read("PADDLE_ENVIRONMENT");
  if (explicit === "sandbox" || explicit === "production") return explicit;
  return apiKey?.includes("_sdbx_") ? "sandbox" : "production";
}

export function paymentsConfig(): PaymentsConfig | null {
  const apiKey = read("PADDLE_API_KEY");
  const eur = read("PADDLE_PRICE_ID_EUR");
  const gbp = read("PADDLE_PRICE_ID_GBP");
  const webhookSecret = read("PADDLE_WEBHOOK_SECRET");
  const clientToken = read("PADDLE_CLIENT_TOKEN");
  return apiKey && eur && gbp && webhookSecret && clientToken
    ? { apiKey, environment: paddleEnvironment(apiKey), priceIds: { EUR: eur, GBP: gbp }, webhookSecret, clientToken }
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
