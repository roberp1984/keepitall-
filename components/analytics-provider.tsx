"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";
import { flushAnalytics, trackPageview } from "@/lib/analytics";
import { SITE } from "@/lib/site";

/** Loads Umami with automatic tracking off, so every pageview is sent with redacted URLs. */
export function AnalyticsProvider() {
  const pathname = usePathname();
  useEffect(() => {
    trackPageview();
  }, [pathname]);

  const { scriptUrl, websiteId, domains } = SITE.analytics;
  return (
    <Script
      src={scriptUrl}
      strategy="afterInteractive"
      data-website-id={websiteId}
      data-domains={domains.join(",")}
      data-auto-track="false"
      data-exclude-search="true"
      data-exclude-hash="true"
      onLoad={flushAnalytics}
    />
  );
}
