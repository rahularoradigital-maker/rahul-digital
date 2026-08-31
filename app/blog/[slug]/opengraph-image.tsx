import { ImageResponse } from "next/og";
import { getArticleBySlug } from "@/lib/growth/articles";

// Per-article social/share card (1200x630). Real content only: the article's own title + topic, on the brand's
// ink ground with the accent. No stock photos, no fabricated imagery. This is the image referenced by the page's
// BlogPosting JSON-LD and og:image, so every post has a genuine share preview and an image signal for crawlers.
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AdBrain article";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getArticleBySlug(slug);
  const title = a?.title ?? "AdBrain";
  const topic = a?.topic ?? "Meta & Google ads";
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
          <div style={{ color: "white", fontSize: 30, fontWeight: 600 }}>AdBrain AI</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ color: "#60a5fa", fontSize: 26, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
            {topic}
          </div>
          <div style={{ color: "white", fontSize: 60, fontWeight: 700, lineHeight: 1.1, maxWidth: 1000 }}>
            {title}
          </div>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 24 }}>Decide what to change in your ads, with a reason for every call.</div>
      </div>
    ),
    { ...size },
  );
}
