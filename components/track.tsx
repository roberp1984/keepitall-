"use client";

import { useEffect } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics";

/** Fires an analytics event once when mounted. */
export function TrackOnMount({ event, properties }: { event: AnalyticsEvent; properties?: Record<string, string | number | boolean> }) {
  useEffect(() => {
    track(event, properties);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
  return null;
}
