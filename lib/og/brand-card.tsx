import { ImageResponse } from "next/og";

// Shared social/share-card (1200x630) generator so every page's og:image is one consistent AdScale card -
// same ink ground + accent + "A" mark as the per-article blog card (app/blog/[slug]/opengraph-image.tsx).
// Real brand only, no stock/fabricated imagery. Each route's opengraph-image.tsx supplies its own eyebrow +
// title; the tagline is the product's one-line promise. Node runtime (next/og), matching the blog card.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export function brandCard(eyebrow: string, title: string, tagline = "Decide what to change in your ads, with a reason for every call.") {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0b1220 0%, #131c31 100%)",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            A
          </div>
          <div style={{ color: "white", fontSize: 30, fontWeight: 600 }}>AdScale AI</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ color: "#60a5fa", fontSize: 26, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{eyebrow}</div>
          <div style={{ color: "white", fontSize: 60, fontWeight: 700, lineHeight: 1.1, maxWidth: 1000 }}>{title}</div>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 24 }}>{tagline}</div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
