/** Funnel events from CLAUDE.md. Wired to PostHog once it is added; no-op until then. */
export type AnalyticsEvent =
  | "check_started"
  | "check_completed"
  | "result_eligible"
  | "result_not_eligible"
  | "checkout_started"
  | "payment_succeeded"
  | "pack_downloaded";

export function track(_event: AnalyticsEvent, _properties: Record<string, string | number | boolean> = {}): void {}
