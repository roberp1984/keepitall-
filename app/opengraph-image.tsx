import { ImageResponse } from "next/og";
import { maxCompensation } from "@/lib/marketing";

export const alt = "KeepItAll – your airline may owe you up to €600. Claim it yourself and keep it all.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Evaluated at build time so the image is generated once and served from cache.
const MAX = maxCompensation(new Date().toISOString().slice(0, 10)) || "€600";
const GREEN = "#0f7a5a";
const INK = "#10241d";

// Link preview for WhatsApp, Instagram, X, Facebook, LinkedIn, iMessage…
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #f3faf6 0%, #dff2e9 100%)",
          color: INK,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 700 }}>
          <span>Keep</span>
          <span style={{ color: GREEN }}>ItAll</span>
          {/* Inline SVG icons: no emoji/font download at build time */}
          <svg width="40" height="40" viewBox="0 0 24 24" style={{ marginLeft: 18 }} fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
          </svg>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 76, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>
            <span>Flight delayed or cancelled?&nbsp;</span>
            <span>Your airline may owe you up to&nbsp;</span>
            <span style={{ color: GREEN }}>{MAX}</span>
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 36, color: "#3d5a50" }}>
            Claim companies take a third. Claim it yourself and keep it all.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              background: GREEN,
              color: "white",
              fontSize: 32,
              fontWeight: 700,
              padding: "18px 34px",
              borderRadius: 16,
              alignItems: "center",
            }}
          >
            Free check in 60 seconds
            <svg width="34" height="34" viewBox="0 0 24 24" style={{ marginLeft: 14 }} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: "#3d5a50" }}>getkeepitall.com</div>
        </div>
      </div>
    ),
    size,
  );
}
