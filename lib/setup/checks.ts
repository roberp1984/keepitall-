import { packPrice } from "../pricing";
import type { Currency } from "../rules/types";

export type CheckStatus = "ok" | "warn" | "fail" | "skip";

export interface CheckResult {
  service: string;
  status: CheckStatus;
  /** Human-readable; never contains secrets. */
  detail: string;
}

/** Which variables are set (values only where they are not secret). */
export interface EnvSnapshot {
  siteUrl: string | null;
  supabase: boolean;
  stripe: { mode: "test" | "live"; priceIds: Record<Currency, string>; webhookSecret: boolean; automaticTax: boolean } | null;
  emailFrom: string | null;
  resend: boolean;
  anthropicModel: string | null;
  posthogKey: string | null;
  cronSecretLength: number;
}

export interface SetupClients {
  /** `select <columns> from claims limit 1`; returns the error message, if any. */
  probeClaims(columns: string): Promise<string | null>;
  stripePrice(priceId: string): Promise<{ name: string; amountCents: number; currency: string; active: boolean; recurring: boolean; taxBehavior: string }>;
  stripeWebhooks(): Promise<{ url: string; events: string[]; enabled: boolean }[]>;
  resendDomains(): Promise<{ name: string; status: string }[]>;
  anthropicModel(model: string): Promise<void>;
}

const MIGRATIONS = {
  init: "supabase/migrations/20261022000000_init.sql",
  lifecycle: "supabase/migrations/20261022010000_lifecycle.sql",
};
const WEBHOOK_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "charge.refunded"];

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 200);

export function emailDomain(from: string): string | null {
  const match = /<?[^\s<>@]+@([^\s<>]+?)>?\s*$/.exec(from.trim());
  return match ? match[1]!.toLowerCase() : null;
}

function checkSite(env: EnvSnapshot, requestOrigin: string | null): CheckResult {
  const service = "Site URL";
  if (!env.siteUrl) return { service, status: "fail", detail: "NEXT_PUBLIC_SITE_URL is not set." };
  if (!env.siteUrl.startsWith("https://") && !env.siteUrl.startsWith("http://localhost")) {
    return { service, status: "fail", detail: `${env.siteUrl} must use https.` };
  }
  if (requestOrigin && requestOrigin !== env.siteUrl) {
    return { service, status: "warn", detail: `Set to ${env.siteUrl}, but this request came to ${requestOrigin}. Emails and checkout redirects use the configured value.` };
  }
  return { service, status: "ok", detail: env.siteUrl };
}

async function checkSupabase(env: EnvSnapshot, c: SetupClients): Promise<CheckResult> {
  const service = "Supabase";
  if (!env.supabase) return { service, status: "fail", detail: "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for checkout." };
  try {
    const base = await c.probeClaims("id");
    if (base) return { service, status: "fail", detail: `Can't read the claims table (${base}). Run ${MIGRATIONS.init}, and check the service-role key.` };
    const lifecycle = await c.probeClaims("followups, followups_opt_out, expired_at");
    if (lifecycle) return { service, status: "fail", detail: `Lifecycle columns missing (${lifecycle}). Run ${MIGRATIONS.lifecycle}.` };
    return { service, status: "ok", detail: "Connected; both migrations applied." };
  } catch (err) {
    return { service, status: "fail", detail: `Connection failed: ${errorText(err)}` };
  }
}

async function checkStripe(env: EnvSnapshot, c: SetupClients): Promise<CheckResult[]> {
  const service = "Stripe";
  if (!env.stripe) {
    return [{ service, status: "fail", detail: "Set STRIPE_SECRET_KEY, STRIPE_PRICE_ID_EUR and STRIPE_PRICE_ID_GBP (plus STRIPE_WEBHOOK_SECRET)." }];
  }
  const results: CheckResult[] = [
    env.stripe.mode === "test"
      ? { service, status: "warn", detail: "Test mode key: only test payments work." }
      : { service, status: "ok", detail: `Live mode${env.stripe.automaticTax ? ", Stripe Tax on" : ""}.` },
  ];

  for (const currency of ["EUR", "GBP"] as const) {
    const label = `${service} · ${currency} price`;
    try {
      const p = await c.stripePrice(env.stripe.priceIds[currency]);
      const charged = `${(p.amountCents / 100).toFixed(2)} ${p.currency}`;
      const expected = packPrice(currency);
      const advertised = `${expected.amount.toFixed(2)} ${expected.currency}`;
      if (!p.active) results.push({ service: label, status: "fail", detail: `Price “${p.name}” is archived; activate it.` });
      else if (p.recurring) results.push({ service: label, status: "fail", detail: `Price “${p.name}” is recurring; it must be one-time.` });
      else if (p.currency !== expected.currency || p.amountCents !== Math.round(expected.amount * 100)) {
        results.push({ service: label, status: "fail", detail: `Price “${p.name}” charges ${charged}; the site shows ${advertised}. Make them match.` });
      } else if (env.stripe.automaticTax && p.taxBehavior !== "inclusive") {
        results.push({ service: label, status: "fail", detail: `Price “${p.name}” must be tax-inclusive, or customers pay more than the site shows.` });
      } else results.push({ service: label, status: "ok", detail: `Price “${p.name}” charges ${charged}, matching the site.` });
    } catch (err) {
      results.push({ service: label, status: "fail", detail: `Can't load price: ${errorText(err)}` });
    }
  }

  const label = `${service} · webhook`;
  if (!env.stripe.webhookSecret) {
    results.push({ service: label, status: "fail", detail: "STRIPE_WEBHOOK_SECRET is not set." });
  } else if (!env.siteUrl) {
    results.push({ service: label, status: "skip", detail: "Set NEXT_PUBLIC_SITE_URL to check the webhook URL." });
  } else {
    const expected = `${env.siteUrl}/api/webhooks/stripe`;
    try {
      const hook = (await c.stripeWebhooks()).find((w) => w.url === expected);
      const missing = hook && !hook.events.includes("*") ? WEBHOOK_EVENTS.filter((e) => !hook.events.includes(e)) : hook ? [] : WEBHOOK_EVENTS;
      if (!hook) results.push({ service: label, status: "fail", detail: `No webhook endpoint points to ${expected}.` });
      else if (!hook.enabled) results.push({ service: label, status: "fail", detail: `The endpoint ${expected} is disabled.` });
      else if (missing.length) results.push({ service: label, status: "fail", detail: `Endpoint is missing events: ${missing.join(", ")}.` });
      else results.push({ service: label, status: "ok", detail: `${expected}. The signing secret can't be checked remotely: it must match STRIPE_WEBHOOK_SECRET.` });
    } catch (err) {
      results.push({ service: label, status: "fail", detail: `Can't list webhook endpoints: ${errorText(err)}` });
    }
  }
  return results;
}

async function checkResend(env: EnvSnapshot, c: SetupClients): Promise<CheckResult> {
  const service = "Resend";
  if (!env.resend || !env.emailFrom) return { service, status: "warn", detail: "RESEND_API_KEY / EMAIL_FROM not set: no emails will be sent." };
  const domain = emailDomain(env.emailFrom);
  if (!domain) return { service, status: "fail", detail: `EMAIL_FROM “${env.emailFrom}” is not a valid address.` };
  try {
    const found = (await c.resendDomains()).find((d) => d.name.toLowerCase() === domain);
    if (!found) return { service, status: "fail", detail: `Domain ${domain} is not added in Resend.` };
    if (found.status !== "verified") return { service, status: "fail", detail: `Domain ${domain} is ${found.status}; finish DNS verification.` };
    return { service, status: "ok", detail: `Sending from ${env.emailFrom} (${domain} verified).` };
  } catch (err) {
    return { service, status: "fail", detail: `Can't reach Resend: ${errorText(err)}` };
  }
}

async function checkAnthropic(env: EnvSnapshot, c: SetupClients): Promise<CheckResult> {
  const service = "Anthropic";
  if (!env.anthropicModel) return { service, status: "skip", detail: "ANTHROPIC_API_KEY not set: claim letters use the static template." };
  try {
    await c.anthropicModel(env.anthropicModel);
    return { service, status: "ok", detail: `Key works; model ${env.anthropicModel} is available.` };
  } catch (err) {
    return { service, status: "fail", detail: `Model ${env.anthropicModel}: ${errorText(err)}` };
  }
}

function checkPosthog(env: EnvSnapshot): CheckResult {
  const service = "PostHog";
  if (!env.posthogKey) return { service, status: "skip", detail: "NEXT_PUBLIC_POSTHOG_KEY not set: no analytics." };
  if (!env.posthogKey.startsWith("phc_")) return { service, status: "warn", detail: "Key doesn't look like a project API key (phc_…)." };
  return { service, status: "ok", detail: "Key set. Make sure cookieless mode is enabled in the project settings." };
}

function checkCron(env: EnvSnapshot): CheckResult {
  const service = "Cron";
  if (env.cronSecretLength === 0) return { service, status: "fail", detail: "CRON_SECRET not set: follow-ups and data retention won't run." };
  if (env.cronSecretLength < 32) return { service, status: "warn", detail: "CRON_SECRET is short; use at least 32 random characters." };
  return { service, status: "ok", detail: "Secret set; Vercel Cron calls /api/cron/daily daily." };
}

/** Read-only checks of every integration. */
export async function runSetupChecks(env: EnvSnapshot, clients: SetupClients, requestOrigin: string | null = null): Promise<CheckResult[]> {
  const [supabase, stripe, resend, anthropic] = await Promise.all([
    checkSupabase(env, clients),
    checkStripe(env, clients),
    checkResend(env, clients),
    checkAnthropic(env, clients),
  ]);
  return [checkSite(env, requestOrigin), supabase, ...stripe, resend, anthropic, checkPosthog(env), checkCron(env)];
}
