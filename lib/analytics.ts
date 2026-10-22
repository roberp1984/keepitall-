"use client";

import posthog from "posthog-js";

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

let started = false;

/**
 * Privacy-first setup: cookieless (no cookies or local storage), no autocapture,
 * no session recording, no person profiles. Requires cookieless mode to be
 * enabled in the PostHog project settings.
 */
export function initAnalytics(key: string | undefined, host: string | undefined): void {
  if (started || !key || typeof window === "undefined") return;
  posthog.init(key, {
    api_host: host || "https://eu.i.posthog.com",
    cookieless_mode: "always",
    persistence: "memory",
    person_profiles: "never",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    advanced_disable_flags: true,
  });
  started = true;
}

export function track(event: AnalyticsEvent, properties: AnalyticsProperties = {}): void {
  if (!started) return;
  posthog.capture(event, properties);
}
