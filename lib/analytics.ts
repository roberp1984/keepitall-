"use client";

import { redactUrl } from "./analytics-path";

/** Funnel events from CLAUDE.md. Never attach personal data to these. */
export type AnalyticsEvent =
  | "check_started"
  | "check_completed"
  | "result_eligible"
  | "result_not_eligible"
  | "checkout_started"
  | "payment_succeeded"
  | "pack_downloaded";

export type AnalyticsProperties = Record<string, string | number | boolean>;

interface UmamiPayload {
  url?: string;
  referrer?: string;
  name?: string;
  data?: AnalyticsProperties;
  [key: string]: unknown;
}

interface Umami {
  track(payload: (props: UmamiPayload) => UmamiPayload): void;
}

declare global {
  interface Window {
    umami?: Umami;
  }
}

type Send = (umami: Umami) => void;
const queue: Send[] = [];

/** Umami (cookieless) loads with `defer`; anything sent before it is ready is queued. */
function send(fn: Send): void {
  if (typeof window === "undefined") return;
  if (window.umami) fn(window.umami);
  else if (queue.length < 50) queue.push(fn);
}

/** Called once the Umami script has loaded. */
export function flushAnalytics(): void {
  const umami = typeof window === "undefined" ? undefined : window.umami;
  if (!umami) return;
  for (const fn of queue.splice(0)) fn(umami);
}

/** Every payload goes through here: no query strings, hashes or pack/result tokens leave the browser. */
const redact = (props: UmamiPayload): UmamiPayload => ({ ...props, url: redactUrl(props.url), referrer: redactUrl(props.referrer) });

export function trackPageview(): void {
  send((u) => u.track(redact));
}

export function track(event: AnalyticsEvent, properties: AnalyticsProperties = {}): void {
  send((u) => u.track((props) => ({ ...redact(props), name: event, data: properties })));
}
