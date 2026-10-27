import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const DESCRIPTION =
  "Check for free if your delayed, cancelled or overbooked flight is owed up to €600 under EU261 or UK261, then claim it yourself and keep it all.";

export const metadata: Metadata = {
  // Makes the generated opengraph/twitter image URLs absolute (required by WhatsApp, Instagram, etc.)
  metadataBase: new URL(SITE_URL),
  title: {
    default: "KeepItAll – claim flight delay compensation yourself",
    template: "%s | KeepItAll",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "KeepItAll",
    locale: "en_GB",
    title: "Flight delayed or cancelled? Your airline may owe you up to €600",
    description: "Free 60-second check. Claim it yourself and keep 100%: no claim company commission.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Flight delayed or cancelled? Your airline may owe you up to €600",
    description: "Free 60-second check. Claim it yourself and keep 100%: no claim company commission.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f7a5a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Suspense fallback={null}>
          <AnalyticsProvider />
        </Suspense>
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
