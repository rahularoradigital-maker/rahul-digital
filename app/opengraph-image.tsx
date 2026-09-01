import { brandCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/brand-card";

// Default site share-card (home + any route without its own opengraph-image). Real brand + promise, no title
// churn. Covers the whole site via Next's file-based convention; the blog + product/pricing override with theirs.
export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "AdScale — creative decision intelligence for Meta & Google ads";

export default function OgImage() {
  return brandCard("Meta & Google ads", "Know exactly what to change in your ads, and why");
}
