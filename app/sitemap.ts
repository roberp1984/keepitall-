import type { MetadataRoute } from "next";
import { allAirlines } from "@/lib/airlines";
import { siteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages = ["", "/check", "/airlines", "/legal/disclaimer", "/legal/terms", "/legal/privacy", "/legal/refunds"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "monthly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
  const airlines = allAirlines().map((a) => ({
    url: `${base}/airlines/${a.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  return [...pages, ...airlines];
}
