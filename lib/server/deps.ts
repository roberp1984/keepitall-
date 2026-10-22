// Server-only composition root: builds service dependencies from environment variables.
import { createSupabaseStore } from "../claims/supabase-store";
import type { ServiceDeps } from "../claims/service";
import { noopEmailSender } from "../email";
import { resendSender } from "../email/resend";
import { anthropicConfigured, emailConfig, siteUrl, supabaseConfig } from "../env";
import { anthropicGenerator } from "../letters/anthropic";
import { renderClaimPackPdf } from "../pdf/claim-pack";

export class NotConfiguredError extends Error {
  override name = "NotConfiguredError";
}

export function serviceDeps(): ServiceDeps {
  const db = supabaseConfig();
  if (!db) throw new NotConfiguredError("Supabase is not configured");
  const email = emailConfig();
  return {
    store: createSupabaseStore(db),
    email: email ? resendSender(email) : noopEmailSender,
    siteUrl: siteUrl(),
    generate: anthropicConfigured() ? anthropicGenerator() : undefined,
    renderPdf: renderClaimPackPdf,
    log: (message, extra) => console.warn(`[claims] ${message}`, extra ?? {}),
  };
}
