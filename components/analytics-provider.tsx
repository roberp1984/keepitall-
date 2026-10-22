"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

export function AnalyticsProvider() {
  useEffect(() => {
    initAnalytics(process.env.NEXT_PUBLIC_POSTHOG_KEY, process.env.NEXT_PUBLIC_POSTHOG_HOST);
  }, []);
  return null;
}
