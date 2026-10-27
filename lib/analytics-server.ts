// Server-only: events that must not depend on the browser (payment confirmation).
import { SITE } from "./site";
import type { AnalyticsEvent, AnalyticsProperties } from "./analytics";

/** Sends one anonymous event to Umami. Only in production; never throws. */
export async function trackServer(
  event: AnalyticsEvent,
  properties: AnalyticsProperties = {},
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (process.env.VERCEL_ENV !== "production") return;
  const { sendUrl, websiteId, domains } = SITE.analytics;
  try {
    const res = await fetchImpl(sendUrl, {
      method: "POST",
      // Umami drops requests without a browser-like user agent.
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (compatible; KeepItAll-server/1.0)" },
      body: JSON.stringify({
        type: "event",
        payload: { website: websiteId, hostname: domains[0], url: "/", language: "en", name: event, data: properties },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.warn("[analytics] server event failed", { event, error: (err as Error).message });
  }
}
