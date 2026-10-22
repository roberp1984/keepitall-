// Server-only: events that must not depend on the browser (payment confirmation).
import { PostHog } from "posthog-node";
import type { AnalyticsEvent, AnalyticsProperties } from "./analytics";

/** Sends one event and flushes; a no-op without a key. Never throws. */
export async function trackServer(
  event: AnalyticsEvent,
  distinctId: string,
  properties: AnalyticsProperties = {},
  client?: Pick<PostHog, "captureImmediate">,
): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!key && !client) return;
  try {
    const posthog = client ?? new PostHog(key!, { host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com", disableGeoip: true });
    await posthog.captureImmediate({ distinctId, event, properties: { ...properties, $process_person_profile: false } });
  } catch (err) {
    console.warn("[analytics] server event failed", { event, error: (err as Error).message });
  }
}
